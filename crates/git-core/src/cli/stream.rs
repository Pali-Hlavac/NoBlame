//! Running a [`GitCommand`] while handing each line of its output to the caller as it comes:
//! for background jobs (fetch, pull, push, clone) that report progress and keep a log.
//!
//! git redraws progress (`Receiving objects:  45% (…)`) by ending the line with `\r` instead
//! of `\n`. Such lines are passed on with `progress: true` and left out of the captured
//! standard error, which keeps only the lines that stay.

use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio_util::sync::CancellationToken;

use super::tree::ProcessTree;
use super::{GitCommand, GitError, GitOutput};

/// Bytes read from a pipe at a time.
const READ_CHUNK: usize = 16 * 1024;

/// Where a line came from.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OutputStream {
    /// Standard output.
    Stdout,
    /// Standard error (git's progress and messages).
    Stderr,
}

/// One line of output, decoded lossily (for display and logs only).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OutputLine {
    /// The text without its line ending.
    pub text: String,
    /// Which pipe it came from.
    pub stream: OutputStream,
    /// It ended with `\r`: git will redraw it (a progress update).
    pub progress: bool,
}

impl GitCommand {
    /// Runs the command, calling `on_line` for every line of output as it arrives, and returns
    /// the output whatever the exit status (standard error without progress updates).
    ///
    /// When `cancel` fires, git and every process it started are killed and
    /// [`GitError::Cancelled`] is returned.
    pub async fn stream(
        &self,
        cancel: &CancellationToken,
        mut on_line: impl FnMut(OutputLine),
    ) -> Result<GitOutput, GitError> {
        if cancel.is_cancelled() {
            return Err(self.cancelled());
        }
        let mut child = self.spawn()?;
        // Dropped on every early return below, killing the tree.
        let mut tree = ProcessTree::attach(&child);
        tracing::debug!(command = %self.display(), cwd = ?self.cwd, "streaming git");
        if let (Some(mut pipe), Some(input)) = (child.stdin.take(), self.stdin.clone()) {
            pipe.write_all(&input)
                .await
                .map_err(|source| self.io(source))?;
            pipe.shutdown().await.map_err(|source| self.io(source))?;
        }
        let mut stdout = child.stdout.take();
        let mut stderr = child.stderr.take();
        let (mut out_buf, mut err_buf) = (vec![0; READ_CHUNK], vec![0; READ_CHUNK]);
        let (mut out_lines, mut err_lines) = (LineSplitter::default(), LineSplitter::default());
        let mut output = GitOutput {
            code: None,
            stdout: Vec::new(),
            stderr: Vec::new(),
        };
        let mut emit =
            |line: &[u8], stream: OutputStream, progress: bool, output: &mut GitOutput| {
                if stream == OutputStream::Stderr && !progress {
                    output.stderr.extend_from_slice(line);
                    output.stderr.push(b'\n');
                }
                on_line(OutputLine {
                    text: String::from_utf8_lossy(line).into_owned(),
                    stream,
                    progress,
                });
            };
        while stdout.is_some() || stderr.is_some() {
            tokio::select! {
                biased;
                () = cancel.cancelled() => return Err(self.cancelled()),
                read = read_some(stdout.as_mut(), &mut out_buf), if stdout.is_some() => {
                    let read = read.map_err(|source| self.io(source))?;
                    if read == 0 {
                        stdout = None;
                        out_lines.finish(|line, progress| emit(line, OutputStream::Stdout, progress, &mut output));
                    } else {
                        output.stdout.extend_from_slice(&out_buf[..read]);
                        out_lines.push(&out_buf[..read], |line, progress| emit(line, OutputStream::Stdout, progress, &mut output));
                    }
                }
                read = read_some(stderr.as_mut(), &mut err_buf), if stderr.is_some() => {
                    let read = read.map_err(|source| self.io(source))?;
                    if read == 0 {
                        stderr = None;
                        err_lines.finish(|line, progress| emit(line, OutputStream::Stderr, progress, &mut output));
                    } else {
                        err_lines.push(&err_buf[..read], |line, progress| emit(line, OutputStream::Stderr, progress, &mut output));
                    }
                }
            }
        }
        let status = tokio::select! {
            biased;
            () = cancel.cancelled() => return Err(self.cancelled()),
            status = child.wait() => status.map_err(|source| self.io(source))?,
        };
        tree.finish();
        output.code = status.code();
        Ok(output)
    }

    fn io(&self, source: std::io::Error) -> GitError {
        GitError::Spawn {
            program: self.program.clone(),
            source,
        }
    }
}

async fn read_some(
    pipe: Option<&mut (impl AsyncReadExt + Unpin)>,
    buffer: &mut [u8],
) -> std::io::Result<usize> {
    match pipe {
        Some(pipe) => pipe.read(buffer).await,
        None => Ok(0),
    }
}

/// Splits a byte stream into lines ended by `\n` or `\r`. A line ended by `\r` is emitted at
/// once as a progress update; when `\n` follows (a `\r\n` ending) it is emitted again as a
/// finished line.
#[derive(Debug, Default)]
pub(super) struct LineSplitter {
    partial: Vec<u8>,
    /// The last line ended with `\r` (kept in `partial` until the next byte).
    after_cr: bool,
}

impl LineSplitter {
    /// Feeds `bytes`, calling `emit(line, ended_with_cr)` for each finished, non-empty line.
    pub(super) fn push(&mut self, bytes: &[u8], mut emit: impl FnMut(&[u8], bool)) {
        for &byte in bytes {
            if self.after_cr {
                self.after_cr = false;
                if byte == b'\n' {
                    emit(&self.partial, false);
                    self.partial.clear();
                    continue;
                }
                self.partial.clear();
            }
            match byte {
                b'\n' => {
                    if !self.partial.is_empty() {
                        emit(&self.partial, false);
                        self.partial.clear();
                    }
                }
                b'\r' => {
                    if !self.partial.is_empty() {
                        emit(&self.partial, true);
                        self.after_cr = true;
                    }
                }
                _ => self.partial.push(byte),
            }
        }
    }

    /// Emits what is left after the stream ended.
    pub(super) fn finish(&mut self, mut emit: impl FnMut(&[u8], bool)) {
        if !self.partial.is_empty() && !self.after_cr {
            emit(&self.partial, false);
        }
        self.partial.clear();
        self.after_cr = false;
    }
}

#[cfg(test)]
mod tests {
    use super::LineSplitter;

    fn split(chunks: &[&[u8]]) -> Vec<(String, bool)> {
        let mut splitter = LineSplitter::default();
        let mut lines = Vec::new();
        for chunk in chunks {
            splitter.push(chunk, |line, progress| {
                lines.push((String::from_utf8_lossy(line).into_owned(), progress));
            });
        }
        splitter.finish(|line, progress| {
            lines.push((String::from_utf8_lossy(line).into_owned(), progress));
        });
        lines
    }

    #[test]
    fn tells_progress_updates_from_lines() {
        assert_eq!(
            split(&[
                b"Receiving: 10%\rReceiving: 1",
                b"00%, done.\nFrom x\r\n tail"
            ]),
            vec![
                ("Receiving: 10%".to_owned(), true),
                ("Receiving: 100%, done.".to_owned(), false),
                ("From x".to_owned(), true),
                ("From x".to_owned(), false),
                (" tail".to_owned(), false),
            ]
        );
    }
}

//! Executing a [`GitCommand`] with captured output and cancellation.

use std::process::Stdio;

use tokio::io::{AsyncRead, AsyncReadExt, AsyncWriteExt};
use tokio::process::Command;
use tokio_util::sync::CancellationToken;

use super::command::{CLEARED_ENV, FIXED_ENV};
use super::{GitCommand, GitError, GitOutput};

/// Windows `CREATE_NO_WINDOW`: git is a console program and would otherwise flash a
/// console window next to the app.
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

impl GitCommand {
    /// Runs the command and returns its output whatever the exit status.
    ///
    /// When `cancel` fires, the process is killed and [`GitError::Cancelled`] is returned.
    /// Only the direct child is killed; helpers it started (ssh, credential helpers) are
    /// handled by the background job model (M5).
    pub async fn output(&self, cancel: &CancellationToken) -> Result<GitOutput, GitError> {
        if cancel.is_cancelled() {
            return Err(self.cancelled());
        }
        let mut child = self
            .to_tokio_command()
            .spawn()
            .map_err(|source| GitError::Spawn {
                program: self.program.clone(),
                source,
            })?;
        let stdin = child.stdin.take();
        let stdout = child.stdout.take();
        let stderr = child.stderr.take();
        let input = self.stdin.clone();
        tracing::debug!(command = %self.display(), cwd = ?self.cwd, "running git");

        // The future owns the child: dropping it on cancellation kills the process.
        let finished = async move {
            let write = async {
                if let (Some(mut pipe), Some(input)) = (stdin, input) {
                    pipe.write_all(&input).await?;
                    pipe.shutdown().await?;
                }
                Ok::<(), std::io::Error>(())
            };
            let (written, stdout, stderr, status) =
                tokio::join!(write, read_all(stdout), read_all(stderr), child.wait());
            written?;
            Ok::<_, std::io::Error>(GitOutput {
                code: status?.code(),
                stdout: stdout?,
                stderr: stderr?,
            })
        };

        tokio::select! {
            biased;
            () = cancel.cancelled() => Err(self.cancelled()),
            result = finished => Ok(result?),
        }
    }

    /// Runs the command and fails with [`GitError::Failed`] on a non-zero exit status.
    pub async fn run(&self, cancel: &CancellationToken) -> Result<GitOutput, GitError> {
        let output = self.output(cancel).await?;
        if output.success() {
            Ok(output)
        } else {
            Err(GitError::Failed {
                command: self.display(),
                code: output.code,
                stderr: output.stderr_lossy(),
            })
        }
    }

    fn to_tokio_command(&self) -> Command {
        let mut command = Command::new(&self.program);
        command
            .args(self.full_args())
            .stdin(if self.stdin.is_some() {
                Stdio::piped()
            } else {
                Stdio::null()
            })
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true);
        for (key, value) in FIXED_ENV {
            command.env(key, value);
        }
        for key in CLEARED_ENV {
            command.env_remove(key);
        }
        if self.read_only {
            command.env("GIT_OPTIONAL_LOCKS", "0");
        }
        if let Some(dir) = &self.cwd {
            command.current_dir(dir);
        }
        #[cfg(windows)]
        command.creation_flags(CREATE_NO_WINDOW);
        command
    }

    fn cancelled(&self) -> GitError {
        GitError::Cancelled {
            command: self.display(),
        }
    }
}

async fn read_all(pipe: Option<impl AsyncRead + Unpin>) -> std::io::Result<Vec<u8>> {
    let mut buffer = Vec::new();
    if let Some(mut pipe) = pipe {
        pipe.read_to_end(&mut buffer).await?;
    }
    Ok(buffer)
}

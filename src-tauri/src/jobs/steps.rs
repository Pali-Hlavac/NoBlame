//! Running a job's git commands one after the other (Fetch all remotes runs one fetch per
//! remote), and reading its kept log from a given line on.

use std::collections::VecDeque;

use git_core::cli::{GitCommand, GitError, GitOutput, OutputLine, OutputStream};

use super::types::JobOutputDto;

/// The command line shown for a job: its steps, `;`-separated as a shell runs them.
pub(super) fn display(steps: &[GitCommand]) -> String {
    steps
        .iter()
        .map(GitCommand::display)
        .collect::<Vec<_>>()
        .join("; ")
}

/// Runs `steps` in order, each line going to `on_line`. With several steps each starts with a
/// `$ <command>` line, as in a terminal. A failing step does not stop the others (as `git fetch
/// --all` goes on with the next remote); the result fails when any did. Cancelling stops all.
pub(super) async fn run_steps(
    steps: Vec<GitCommand>,
    cancel: &tokio_util::sync::CancellationToken,
    mut on_line: impl FnMut(OutputLine),
) -> Result<GitOutput, GitError> {
    let several = steps.len() > 1;
    let mut combined: Option<GitOutput> = None;
    for step in steps {
        if several {
            on_line(OutputLine {
                text: format!("$ {}", step.display()),
                stream: OutputStream::Stdout,
                progress: false,
            });
        }
        let output = step.stream(cancel, &mut on_line).await?;
        combined = Some(match combined {
            None => output,
            Some(all) => merged(all, output),
        });
    }
    Ok(combined.unwrap_or(GitOutput {
        code: Some(0),
        stdout: Vec::new(),
        stderr: Vec::new(),
    }))
}

/// Both outputs, one after the other; the exit code of the first failure, else the last.
fn merged(mut all: GitOutput, next: GitOutput) -> GitOutput {
    all.stdout.extend(next.stdout);
    all.stderr.extend(next.stderr);
    if all.success() {
        all.code = next.code;
    }
    all
}

/// The lines of `log` from line `from` on, where `log` lost its first `dropped` lines.
pub(super) fn lines_from(log: &VecDeque<String>, dropped: u32, from: u32) -> JobOutputDto {
    let start = from.max(dropped);
    let skip = usize::try_from(start - dropped).unwrap_or(usize::MAX);
    JobOutputDto {
        from: start,
        lines: log.iter().skip(skip).cloned().collect(),
    }
}

#[cfg(test)]
mod tests {
    use std::collections::VecDeque;

    use git_core::cli::GitOutput;

    use super::{lines_from, merged};

    #[test]
    fn reads_only_new_lines_and_skips_dropped_ones() {
        let log: VecDeque<String> = ["c", "d", "e"].map(String::from).into();
        // Lines 0 and 1 (a, b) were dropped.
        let new = lines_from(&log, 2, 4);
        assert_eq!((new.from, new.lines), (4, vec!["e".to_owned()]));
        let late = lines_from(&log, 2, 0);
        assert_eq!((late.from, late.lines.len()), (2, 3));
        assert!(lines_from(&log, 2, 5).lines.is_empty());
    }

    #[test]
    fn a_failed_step_fails_the_job() {
        let output = |code, text: &str| GitOutput {
            code: Some(code),
            stdout: Vec::new(),
            stderr: text.as_bytes().to_vec(),
        };
        let failed = merged(output(0, "a\n"), output(128, "fatal: b\n"));
        let after = merged(failed, output(0, "c\n"));
        assert_eq!(after.code, Some(128));
        assert_eq!(after.stderr_lossy(), "a\nfatal: b\nc");
    }
}

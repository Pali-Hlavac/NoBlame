//! The captured result of a finished git process.

/// Exit status and raw output of a git process. Output stays as bytes: paths and messages
/// may legally be non-UTF-8, so decoding is left to the parser that knows the format.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GitOutput {
    /// Exit code, or `None` when the process was terminated by a signal.
    pub code: Option<i32>,
    /// Everything the process wrote to standard output.
    pub stdout: Vec<u8>,
    /// Everything the process wrote to standard error.
    pub stderr: Vec<u8>,
}

impl GitOutput {
    /// True when git exited with status 0.
    pub fn success(&self) -> bool {
        self.code == Some(0)
    }

    /// Standard output decoded lossily, for display and logs only.
    pub fn stdout_lossy(&self) -> String {
        String::from_utf8_lossy(&self.stdout).into_owned()
    }

    /// Standard error decoded lossily and trimmed, for display and logs only.
    pub fn stderr_lossy(&self) -> String {
        String::from_utf8_lossy(&self.stderr).trim().to_owned()
    }

    /// Everything git printed for the user (standard output, then standard error), trimmed:
    /// what a write command (commit, stash) reports, or why it refused.
    pub fn combined(&self) -> String {
        let mut text = self.stdout_lossy();
        let stderr = self.stderr_lossy();
        if !stderr.is_empty() {
            if !text.trim().is_empty() {
                text.push('\n');
            }
            text.push_str(&stderr);
        }
        text.trim().to_owned()
    }
}

//! A located git executable and the commands that inspect it.

use std::path::{Path, PathBuf};

use tokio_util::sync::CancellationToken;

use super::{GitCommand, GitError, GitVersion, locate};

/// The git executable NoBlame runs. Cheap to clone; holds only the path.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Git {
    program: PathBuf,
}

impl Git {
    /// Uses the git found by [`locate::locate_git`].
    pub fn locate() -> Result<Self, GitError> {
        locate::locate_git().map(Self::at)
    }

    /// Uses the executable at `program` without checking it.
    pub fn at(program: impl Into<PathBuf>) -> Self {
        Self {
            program: program.into(),
        }
    }

    /// Absolute path of the executable.
    pub fn program(&self) -> &Path {
        &self.program
    }

    /// Starts building a command run by this executable.
    pub fn command(&self) -> GitCommand {
        GitCommand::new(self.program.clone())
    }

    /// Runs `git --version` and parses the result.
    pub async fn version(&self, cancel: &CancellationToken) -> Result<GitVersion, GitError> {
        let output = self.command().arg("--version").run(cancel).await?;
        GitVersion::parse(&output.stdout_lossy())
    }
}

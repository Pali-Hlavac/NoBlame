//! Building a git command line that cannot be hijacked by user input.

use std::ffi::{OsStr, OsString};
use std::path::{Path, PathBuf};

use super::{GitError, validate_revision};

/// Configuration overrides passed with `-c` to every command. They change how output is
/// rendered (never what git does), so parsers see stable, uncolored, unquoted paths.
pub(super) const CONFIG_OVERRIDES: &[&str] = &["core.quotepath=false", "color.ui=false"];

/// Environment set for every command: a fixed locale for parseable messages and no
/// interactive terminal prompts (the app has no terminal to answer them).
pub(super) const FIXED_ENV: &[(&str, &str)] = &[("LC_ALL", "C"), ("GIT_TERMINAL_PROMPT", "0")];

/// Inherited variables that would silently redirect git to another repository or index.
pub(super) const CLEARED_ENV: &[&str] = &[
    "GIT_DIR",
    "GIT_WORK_TREE",
    "GIT_INDEX_FILE",
    "GIT_OBJECT_DIRECTORY",
    "GIT_ALTERNATE_OBJECT_DIRECTORIES",
    "GIT_NAMESPACE",
    "GIT_PREFIX",
];

/// One git invocation. Construct it with [`Git::command`](super::Git::command), add
/// arguments, then call [`run`](Self::run) or [`output`](Self::output).
///
/// Arguments can only be added as literal flags ([`arg`](Self::arg)), `--name=value`
/// options ([`option`](Self::option)), validated revisions ([`revision`](Self::revision)) or
/// paths after `--` ([`paths`](Self::paths)), so user input is never parsed as an option.
#[derive(Debug, Clone)]
pub struct GitCommand {
    pub(super) program: PathBuf,
    pub(super) cwd: Option<PathBuf>,
    pub(super) args: Vec<OsString>,
    pub(super) read_only: bool,
    pub(super) stdin: Option<Vec<u8>>,
    has_separator: bool,
}

impl GitCommand {
    pub(super) fn new(program: PathBuf) -> Self {
        Self {
            program,
            cwd: None,
            args: Vec::new(),
            read_only: false,
            stdin: None,
            has_separator: false,
        }
    }

    /// Runs git in `dir` (usually the repository's work tree).
    #[must_use]
    pub fn current_dir(mut self, dir: impl Into<PathBuf>) -> Self {
        self.cwd = Some(dir.into());
        self
    }

    /// Marks the command as read-only: adds `--no-optional-locks`, so it never takes locks
    /// (such as the index lock taken to refresh stat data) that the user's own git needs.
    #[must_use]
    pub fn read_only(mut self) -> Self {
        self.read_only = true;
        self
    }

    /// Appends a literal argument written in the source code, e.g. a subcommand or flag.
    /// Values that come from users or repositories go through the other methods.
    #[must_use]
    pub fn arg(mut self, arg: &'static str) -> Self {
        self.push(arg);
        self
    }

    /// Appends several literal arguments; see [`arg`](Self::arg).
    #[must_use]
    pub fn args(mut self, args: impl IntoIterator<Item = &'static str>) -> Self {
        for arg in args {
            self.push(arg);
        }
        self
    }

    /// Appends `name=value` as one argument (e.g. `--format=%H`), so the value can never be
    /// mistaken for a separate option, whatever it contains.
    #[must_use]
    pub fn option(mut self, name: &'static str, value: impl AsRef<OsStr>) -> Self {
        let mut joined = OsString::from(name);
        joined.push("=");
        joined.push(value.as_ref());
        self.push(joined);
        self
    }

    /// Appends a revision (commit id, refname, `HEAD~2`, ...) after validating it.
    pub fn revision(mut self, revision: &str) -> Result<Self, GitError> {
        validate_revision(revision)?;
        self.push(revision);
        Ok(self)
    }

    /// Appends `--` (once) followed by `paths`. After `--` git treats every argument as a
    /// path, even one that starts with `-`.
    #[must_use]
    pub fn paths<P: AsRef<Path>>(mut self, paths: impl IntoIterator<Item = P>) -> Self {
        if !self.has_separator {
            self.push("--");
            self.has_separator = true;
        }
        for path in paths {
            self.push(path.as_ref().as_os_str());
        }
        self
    }

    /// Bytes written to the process's standard input (e.g. a commit message with `-F -`).
    #[must_use]
    pub fn stdin(mut self, input: impl Into<Vec<u8>>) -> Self {
        self.stdin = Some(input.into());
        self
    }

    /// Every argument passed to the executable, including the global ones added for safety.
    pub fn full_args(&self) -> Vec<OsString> {
        let mut full = Vec::with_capacity(self.args.len() + CONFIG_OVERRIDES.len() * 2 + 1);
        for config in CONFIG_OVERRIDES {
            full.push(OsString::from("-c"));
            full.push(OsString::from(config));
        }
        if self.read_only {
            full.push(OsString::from("--no-optional-locks"));
        }
        full.extend(self.args.iter().cloned());
        full
    }

    /// The command line as the user would type it (`git log --oneline`), for logs and the
    /// "equivalent command" shown with background jobs. Safety overrides are left out.
    pub fn display(&self) -> String {
        let mut line = String::from("git");
        for arg in &self.args {
            line.push(' ');
            line.push_str(&arg.to_string_lossy());
        }
        line
    }

    fn push(&mut self, arg: impl Into<OsString>) {
        self.args.push(arg.into());
    }
}

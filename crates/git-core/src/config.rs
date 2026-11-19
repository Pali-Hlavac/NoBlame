//! Git's settings (`git config`) of one scope: the repository's own (`--local`, `.git/config`)
//! or the user's (`--global`, `~/.gitconfig`, every repository). Read with
//! `git config --list --show-origin -z`; written with `--replace-all` and removed with
//! `--unset-all`, the key and value after `--`. Only what the user asks for in the app is
//! written; system settings are never touched. Every scope at once with each value's file:
//! `scoped.rs`; several keys changed all or nothing: `plan.rs`; secrets hidden: `secret.rs`.

mod plan;
mod scoped;
mod secret;

pub use plan::{
    KeyChange, PlanError, PlannedKey, StepAction, apply_plan, describe_plan, failed, plan_changes,
    quote, restore, steps_for,
};
pub use scoped::{Scope, ScopedEntry, canonical_key, parse_scoped_list, read_all_scopes};
pub use secret::{HIDDEN, has_password, holds_hidden, redact_key, redact_value};

use std::path::Path;

use tokio_util::sync::CancellationToken;

use crate::cli::{Git, GitCommand, GitError};

/// Which settings file.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConfigScope {
    /// The repository's own (`.git/config`).
    Local,
    /// The user's, for every repository (`~/.gitconfig`).
    Global,
}

impl ConfigScope {
    fn flag(self) -> &'static str {
        match self {
            Self::Local => "--local",
            Self::Global => "--global",
        }
    }
}

/// Failures of reading or writing settings.
#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    /// git could not run.
    #[error(transparent)]
    Git(#[from] GitError),
    /// git refused; `output` is what it said.
    #[error("{output}")]
    Rejected {
        /// Standard output and standard error, trimmed.
        output: String,
    },
    /// The key is not one git accepts (`section.name` or `section.sub.name`).
    #[error("“{0}” is not a setting name. Names look like user.name or remote.origin.url.")]
    InvalidKey(String),
}

/// One setting; a key set several times appears once per value.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ConfigEntry {
    /// `section.name`, as git lists it (section and name in lower case).
    pub key: String,
    /// Its value.
    pub value: String,
}

/// The settings of one scope.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ConfigFile {
    /// The file, as git names it; `None` when it does not exist yet.
    pub path: Option<String>,
    /// Its settings, in file order.
    pub entries: Vec<ConfigEntry>,
}

/// Checks `key`: a section, optional subsection and name, separated by dots; the section and
/// name of letters, digits and `-`, starting with a letter; no line breaks.
pub fn validate_key(key: &str) -> Result<(), ConfigError> {
    let invalid = || ConfigError::InvalidKey(key.to_owned());
    let (Some((section, _)), Some((_, name))) = (key.split_once('.'), key.rsplit_once('.')) else {
        return Err(invalid());
    };
    let plain = |part: &str| {
        part.chars().next().is_some_and(|c| c.is_ascii_alphabetic())
            && part.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
    };
    if !plain(section) || !plain(name) || key.contains(['\n', '\0']) {
        return Err(invalid());
    }
    Ok(())
}

/// The entries of `git config --list --show-origin -z` output (`file:<path>\0key\nvalue\0`),
/// with the file of the first one.
pub fn parse_config_list(output: &[u8]) -> ConfigFile {
    let text = String::from_utf8_lossy(output);
    let mut fields = text.split('\0');
    let mut path = None;
    let mut entries = Vec::new();
    while let (Some(origin), Some(entry)) = (fields.next(), fields.next()) {
        if path.is_none() {
            path = origin.strip_prefix("file:").map(str::to_owned);
        }
        let (key, value) = entry.split_once('\n').unwrap_or((entry, ""));
        entries.push(ConfigEntry {
            key: key.to_owned(),
            value: value.to_owned(),
        });
    }
    ConfigFile { path, entries }
}

fn config(git: &Git, dir: &Path, scope: ConfigScope) -> GitCommand {
    git.command()
        .current_dir(dir)
        .arg("config")
        .arg(scope.flag())
}

/// The settings of `scope` as seen from the repository at `dir`.
pub async fn read_config(
    git: &Git,
    dir: &Path,
    scope: ConfigScope,
    cancel: &CancellationToken,
) -> Result<ConfigFile, ConfigError> {
    let output = config(git, dir, scope)
        .read_only()
        .args(["--list", "--show-origin", "-z"])
        .output(cancel)
        .await?;
    if output.success() {
        return Ok(parse_config_list(&output.stdout));
    }
    let said = output.combined();
    if said.contains("unable to read config file") {
        // No such file yet: nothing set there.
        return Ok(ConfigFile {
            path: None,
            entries: Vec::new(),
        });
    }
    Err(ConfigError::Rejected { output: said })
}

async fn write(command: GitCommand, cancel: &CancellationToken) -> Result<(), ConfigError> {
    let output = command.output(cancel).await?;
    if output.success() {
        Ok(())
    } else {
        Err(ConfigError::Rejected {
            output: output.combined(),
        })
    }
}

/// Sets `key` to `value` in `scope` (replacing every value it had).
pub async fn set_config(
    git: &Git,
    dir: &Path,
    scope: ConfigScope,
    key: &str,
    value: &str,
    cancel: &CancellationToken,
) -> Result<(), ConfigError> {
    validate_key(key)?;
    let command = config(git, dir, scope)
        .arg("--replace-all")
        .operands([key, value]);
    write(command, cancel).await
}

/// Removes `key` (every value) from `scope`.
pub async fn unset_config(
    git: &Git,
    dir: &Path,
    scope: ConfigScope,
    key: &str,
    cancel: &CancellationToken,
) -> Result<(), ConfigError> {
    validate_key(key)?;
    let command = config(git, dir, scope).arg("--unset-all").operands([key]);
    write(command, cancel).await
}

#[cfg(test)]
mod tests {
    use super::{ConfigEntry, parse_config_list, validate_key};

    #[test]
    fn checks_setting_names() {
        for good in [
            "user.name",
            "remote.origin.url",
            "branch.feat/x y.merge",
            "core.autoCRLF",
        ] {
            assert!(validate_key(good).is_ok(), "{good}");
        }
        for bad in [
            "user",
            ".name",
            "user.",
            "-c.x",
            "1a.b",
            "a.b\nc",
            "user.na_me",
        ] {
            assert!(validate_key(bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn reads_listed_settings_with_their_file() {
        let output = b"file:.git/config\0user.email\nada@example.com\0file:.git/config\0my.flag\0";
        let file = parse_config_list(output);
        assert_eq!(file.path.as_deref(), Some(".git/config"));
        assert_eq!(
            file.entries,
            vec![
                ConfigEntry {
                    key: "user.email".into(),
                    value: "ada@example.com".into(),
                },
                ConfigEntry {
                    key: "my.flag".into(),
                    value: String::new(),
                },
            ]
        );
    }
}

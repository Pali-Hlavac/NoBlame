//! Settings of every scope at once, each value with the scope and file it comes from
//! (`git config --list --show-origin --show-scope -z`), for editors that show what is set here
//! and what is inherited from the user's or the system's settings.

use std::path::Path;

use tokio_util::sync::CancellationToken;

use crate::cli::Git;

use super::ConfigError;

/// Where a value is set.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Scope {
    /// The installation's (`/etc/gitconfig`, `C:\Program Files\Git\etc\gitconfig`).
    System,
    /// The user's (`~/.gitconfig`).
    Global,
    /// The repository's own (`.git/config`).
    Local,
    /// The worktree's own (`config.worktree`).
    Worktree,
}

impl Scope {
    fn parse(text: &str) -> Option<Self> {
        match text {
            "system" => Some(Self::System),
            "global" => Some(Self::Global),
            "local" => Some(Self::Local),
            "worktree" => Some(Self::Worktree),
            // `command` (our own `-c` options) and anything newer.
            _ => None,
        }
    }
}

/// One value with where it is set; a key set several times appears once per value.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ScopedEntry {
    /// The scope.
    pub scope: Scope,
    /// The file, as git names it (`.git/config`, `C:/Users/ada/.gitconfig`).
    pub file: Option<String>,
    /// The key with section and name in lower case, as git lists it (`remote.origin.pushurl`).
    pub key: String,
    /// The value; a key written without one (`[remote "a"] flag`) reads as `true`, as git
    /// treats it.
    pub value: String,
}

/// The value of a key written without `= value`.
const IMPLICIT_TRUE: &str = "true";

/// The entries of `git config --list --show-origin --show-scope -z` output
/// (`scope\0file:<path>\0key\nvalue\0`), without those of the command line.
pub fn parse_scoped_list(output: &[u8]) -> Vec<ScopedEntry> {
    let text = String::from_utf8_lossy(output);
    let mut fields = text.split('\0');
    let mut entries = Vec::new();
    while let (Some(scope), Some(origin), Some(entry)) =
        (fields.next(), fields.next(), fields.next())
    {
        let Some(scope) = Scope::parse(scope) else {
            continue;
        };
        let (key, value) = entry.split_once('\n').unwrap_or((entry, IMPLICIT_TRUE));
        entries.push(ScopedEntry {
            scope,
            file: origin.strip_prefix("file:").map(str::to_owned),
            key: key.to_owned(),
            value: value.to_owned(),
        });
    }
    entries
}

/// Every setting the repository at `dir` sees, in the order git reads them (system, user,
/// repository, worktree), so a later value overrides an earlier one.
pub async fn read_all_scopes(
    git: &Git,
    dir: &Path,
    cancel: &CancellationToken,
) -> Result<Vec<ScopedEntry>, ConfigError> {
    let output = git
        .command()
        .current_dir(dir)
        .read_only()
        .args(["config", "--list", "--show-origin", "--show-scope", "-z"])
        .output(cancel)
        .await?;
    if output.success() {
        Ok(parse_scoped_list(&output.stdout))
    } else {
        Err(ConfigError::Rejected {
            output: output.combined(),
        })
    }
}

/// `key` as git lists it: section and name in lower case, the subsection as written
/// (`remote.Origin.tagOpt` → `remote.Origin.tagopt`).
pub fn canonical_key(key: &str) -> String {
    match (key.split_once('.'), key.rsplit_once('.')) {
        (Some((section, _)), Some((head, name))) if head.len() > section.len() => {
            let subsection = &head[section.len() + 1..];
            format!(
                "{}.{subsection}.{}",
                section.to_ascii_lowercase(),
                name.to_ascii_lowercase()
            )
        }
        _ => key.to_ascii_lowercase(),
    }
}

#[cfg(test)]
mod tests {
    use super::{Scope, ScopedEntry, canonical_key, parse_scoped_list};

    #[test]
    fn reads_scopes_files_and_values_without_the_command_line() {
        let output = b"global\0file:C:/u/.gitconfig\0user.name\nAda\0\
            local\0file:.git/config\0remote.origin.flag\0\
            command\0command line:\0core.quotepath\nfalse\0";
        assert_eq!(
            parse_scoped_list(output),
            vec![
                ScopedEntry {
                    scope: Scope::Global,
                    file: Some("C:/u/.gitconfig".into()),
                    key: "user.name".into(),
                    value: "Ada".into(),
                },
                ScopedEntry {
                    scope: Scope::Local,
                    file: Some(".git/config".into()),
                    key: "remote.origin.flag".into(),
                    value: "true".into(),
                },
            ]
        );
    }

    #[test]
    fn lowers_section_and_name_but_not_the_subsection() {
        assert_eq!(
            canonical_key("remote.Up.Stream.tagOpt"),
            "remote.Up.Stream.tagopt"
        );
        assert_eq!(canonical_key("Push.followTags"), "push.followtags");
        assert_eq!(
            canonical_key("http.https://h/A.sslVerify"),
            "http.https://h/A.sslverify"
        );
    }
}

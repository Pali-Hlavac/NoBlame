//! User scripts: git command lines the user writes in Settings (`log --oneline {sha}`), run on a
//! commit. The line is split into arguments first (quotes group words), then placeholders are
//! filled in inside each argument, so a value with spaces (a subject) stays one argument. No
//! shell is involved: the arguments go to `git` as they are.

use std::path::Path;

use crate::cli::{Git, GitCommand};

/// Placeholders a script may use, with what they stand for.
pub const PLACEHOLDERS: &[(&str, &str)] = &[
    ("{sha}", "the commit's full id"),
    ("{short}", "its short id (8 characters)"),
    ("{subject}", "its subject line"),
    ("{branch}", "the branch checked out"),
    ("{repo}", "the repository's folder"),
];

/// Length of `{short}`.
const SHORT_ID: usize = 8;

/// Why a script cannot run.
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum ScriptError {
    /// The command line is empty.
    #[error("The script has no git command.")]
    Empty,
    /// A quote is not closed.
    #[error("A quote in the script is not closed.")]
    OpenQuote,
    /// A `{name}` that is not a placeholder.
    #[error(
        "{0} is not a placeholder. Use {{sha}}, {{short}}, {{subject}}, {{branch}} or {{repo}}."
    )]
    UnknownPlaceholder(String),
    /// `{branch}` with no branch checked out.
    #[error("The script uses {{branch}}, but no branch is checked out (HEAD is detached).")]
    NoBranch,
    /// A value that would be read as an option (`{subject}` starting with `-`).
    #[error("The value for {0} starts with “-”: git would read it as an option.")]
    OptionLike(String),
}

/// What the placeholders stand for.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ScriptValues {
    /// The commit's full id.
    pub sha: String,
    /// Its subject line.
    pub subject: String,
    /// The branch checked out; `None` when HEAD is detached.
    pub branch: Option<String>,
    /// The repository's folder.
    pub repo: String,
}

/// `line` split into arguments: spaces separate them; `"…"` and `'…'` group words (no escapes).
/// A leading `git` is dropped (the script is git's arguments).
pub fn split_command(line: &str) -> Result<Vec<String>, ScriptError> {
    let mut args = Vec::new();
    let mut current = String::new();
    let mut quote: Option<char> = None;
    let mut started = false;
    for c in line.chars() {
        match (quote, c) {
            (Some(open), c) if c == open => quote = None,
            (Some(_), c) => current.push(c),
            (None, '"' | '\'') => {
                quote = Some(c);
                started = true;
            }
            (None, c) if c.is_whitespace() => {
                if started {
                    args.push(std::mem::take(&mut current));
                    started = false;
                }
            }
            (None, c) => {
                current.push(c);
                started = true;
            }
        }
    }
    if quote.is_some() {
        return Err(ScriptError::OpenQuote);
    }
    if started {
        args.push(current);
    }
    if args.first().is_some_and(|first| first == "git") {
        args.remove(0);
    }
    if args.is_empty() {
        return Err(ScriptError::Empty);
    }
    Ok(args)
}

fn value<'a>(name: &str, values: &'a ScriptValues) -> Result<Option<&'a str>, ScriptError> {
    Ok(match name {
        "{sha}" => Some(&values.sha),
        "{short}" => Some(values.sha.get(..SHORT_ID).unwrap_or(&values.sha)),
        "{subject}" => Some(&values.subject),
        "{branch}" => Some(values.branch.as_deref().ok_or(ScriptError::NoBranch)?),
        "{repo}" => Some(&values.repo),
        _ => None,
    })
}

/// `arg` with its placeholders filled in. An argument that is only a placeholder must not
/// become an option.
fn expand_arg(arg: &str, values: &ScriptValues) -> Result<String, ScriptError> {
    let mut out = String::new();
    let mut rest = arg;
    while let Some(start) = rest.find('{') {
        let Some(len) = rest[start..].find('}') else {
            break;
        };
        let name = &rest[start..=start + len];
        out.push_str(&rest[..start]);
        match value(name, values)? {
            Some(text) => {
                if name == arg && text.starts_with('-') {
                    return Err(ScriptError::OptionLike(name.to_owned()));
                }
                out.push_str(text);
            }
            // `{}` or `HEAD@{1}`: not a placeholder name.
            None if !name[1..name.len() - 1].chars().all(char::is_alphabetic)
                || name.len() <= 2 =>
            {
                out.push_str(name);
            }
            None => return Err(ScriptError::UnknownPlaceholder(name.to_owned())),
        }
        rest = &rest[start + len + 1..];
    }
    out.push_str(rest);
    Ok(out)
}

/// The arguments of `line` with the placeholders filled in.
pub fn expand_script(line: &str, values: &ScriptValues) -> Result<Vec<String>, ScriptError> {
    split_command(line)?
        .iter()
        .map(|arg| expand_arg(arg, values))
        .collect()
}

/// The git command for `line` in `dir`, as a step of a background job.
pub fn script_command(
    git: &Git,
    dir: &Path,
    line: &str,
    values: &ScriptValues,
) -> Result<GitCommand, ScriptError> {
    let args = expand_script(line, values)?;
    Ok(git.command().current_dir(dir).user_args(args))
}

#[cfg(test)]
#[path = "script_tests.rs"]
mod tests;

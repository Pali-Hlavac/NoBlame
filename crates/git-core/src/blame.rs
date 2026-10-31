//! Who last changed each line of a file: `git blame --incremental`, the user's git, so
//! `blame.ignoreRevsFile`, `.mailmap` and rename following behave as in a terminal (ADR 0022).
//! Missing objects of a partial clone are never downloaded; blame then fails.

use std::collections::HashMap;
use std::path::Path;

use gix::ObjectId;
use gix::bstr::{BStr, BString, ByteSlice};
use tokio_util::sync::CancellationToken;

use crate::cli::{Git, GitError};

/// Failures while blaming a file.
#[derive(Debug, thiserror::Error)]
pub enum BlameError {
    /// `git blame` failed (for example: the file does not exist in that commit) or was
    /// cancelled.
    #[error(transparent)]
    Git(#[from] GitError),
    /// The output was not understood.
    #[error("unexpected `git blame` output: {0}")]
    Parse(String),
}

/// A commit that some lines come from.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BlameCommit {
    /// The commit.
    pub id: ObjectId,
    /// First line of its message (lossy if not UTF-8).
    pub summary: String,
    /// Author name, after `.mailmap` (lossy if not UTF-8).
    pub author_name: String,
    /// Author e-mail, without the angle brackets.
    pub author_email: String,
    /// Author time, seconds since the epoch.
    pub author_time: i64,
    /// The parent and the file's path there, to blame the version before this commit; `None`
    /// when the commit added the file (or is a root or boundary commit).
    pub previous: Option<(ObjectId, BString)>,
}

/// Consecutive lines that come from one commit.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct BlameHunk {
    /// First line in the blamed file (1-based).
    pub line: u32,
    /// Number of lines.
    pub count: u32,
    /// Index into [`Blame::commits`].
    pub commit: usize,
    /// First line in the commit's version of the file (1-based).
    pub original_line: u32,
    /// Index into [`Blame::paths`]: the file's path in that commit.
    pub path: usize,
}

/// The blame of one file.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct Blame {
    /// Ordered by line; every line of the file is in exactly one hunk.
    pub hunks: Vec<BlameHunk>,
    /// The commits the hunks name.
    pub commits: Vec<BlameCommit>,
    /// The paths the hunks name (more than one when the file was renamed).
    pub paths: Vec<BString>,
}

/// Blames `path` (relative to the top of the working tree, `/`-separated) as it is in
/// `commit`.
pub async fn blame(
    git: &Git,
    dir: &Path,
    commit: ObjectId,
    path: &BStr,
    cancel: &CancellationToken,
) -> Result<Blame, BlameError> {
    let path = gix::path::from_bstr(path)
        .map_err(|error| BlameError::Parse(error.to_string()))?
        .into_owned();
    let output = git
        .command()
        .current_dir(dir)
        .read_only()
        .no_lazy_fetch()
        .args(["blame", "--incremental"])
        .revision(&commit.to_string())?
        .paths([path])
        .run(cancel)
        .await?;
    parse_incremental(&output.stdout)
}

/// Reads `--incremental` output: per hunk a `<id> <original> <final> <count>` line, the
/// commit's headers the first time it appears, and a closing `filename <path>` line.
fn parse_incremental(output: &[u8]) -> Result<Blame, BlameError> {
    let mut blame = Blame::default();
    let mut known: HashMap<ObjectId, usize> = HashMap::new();
    let mut current: Option<BlameHunk> = None;
    for line in output.lines() {
        if let Some(hunk) = current.as_mut() {
            let commit = &mut blame.commits[hunk.commit];
            let (key, value) = line.split_once_str(" ").unwrap_or((line, b""));
            match key {
                b"filename" => {
                    hunk.path = path_index(&mut blame.paths, unquote(value));
                    blame.hunks.push(*hunk);
                    current = None;
                }
                b"summary" => commit.summary = value.to_str_lossy().into_owned(),
                b"author" => commit.author_name = value.to_str_lossy().into_owned(),
                b"author-mail" => {
                    let email = value
                        .trim_start_with(|c| c == '<')
                        .trim_end_with(|c| c == '>');
                    commit.author_email = email.to_str_lossy().into_owned();
                }
                b"author-time" => commit.author_time = number(value)?,
                b"previous" => {
                    let (id, path) = value.split_once_str(" ").unwrap_or((value, b""));
                    commit.previous = Some((object_id(id)?, unquote(path)));
                }
                _ => {}
            }
            continue;
        }
        let fields: Vec<&[u8]> = line.split_str(" ").collect();
        let [id, original_line, line_number, count] = fields.as_slice() else {
            return Err(BlameError::Parse(line.to_str_lossy().into_owned()));
        };
        let id = object_id(id)?;
        let commit = *known.entry(id).or_insert_with(|| {
            blame.commits.push(BlameCommit {
                id,
                summary: String::new(),
                author_name: String::new(),
                author_email: String::new(),
                author_time: 0,
                previous: None,
            });
            blame.commits.len() - 1
        });
        current = Some(BlameHunk {
            line: number(line_number)?,
            count: number(count)?,
            commit,
            original_line: number(original_line)?,
            path: 0,
        });
    }
    blame.hunks.sort_by_key(|hunk| hunk.line);
    Ok(blame)
}

fn path_index(paths: &mut Vec<BString>, path: BString) -> usize {
    paths
        .iter()
        .position(|known| *known == path)
        .unwrap_or_else(|| {
            paths.push(path);
            paths.len() - 1
        })
}

fn object_id(hex: &[u8]) -> Result<ObjectId, BlameError> {
    ObjectId::from_hex(hex).map_err(|error| BlameError::Parse(error.to_string()))
}

fn number<T: std::str::FromStr>(text: &[u8]) -> Result<T, BlameError> {
    text.to_str()
        .ok()
        .and_then(|text| text.parse().ok())
        .ok_or_else(|| BlameError::Parse(text.to_str_lossy().into_owned()))
}

/// A path as git prints it: as is, or in double quotes with C escapes when it holds a quote,
/// a backslash or a control character.
fn unquote(text: &[u8]) -> BString {
    let Some(inner) = text
        .strip_prefix(b"\"")
        .and_then(|rest| rest.strip_suffix(b"\""))
    else {
        return text.into();
    };
    let mut out = Vec::with_capacity(inner.len());
    let mut bytes = inner.iter().copied();
    while let Some(byte) = bytes.next() {
        if byte != b'\\' {
            out.push(byte);
            continue;
        }
        match bytes.next() {
            Some(b'n') => out.push(b'\n'),
            Some(b't') => out.push(b'\t'),
            Some(b'r') => out.push(b'\r'),
            Some(digit @ b'0'..=b'7') => {
                let mut value = u32::from(digit - b'0');
                for _ in 0..2 {
                    if let Some(next @ b'0'..=b'7') = bytes.clone().next() {
                        value = value * 8 + u32::from(next - b'0');
                        bytes.next();
                    }
                }
                out.push(u8::try_from(value).unwrap_or(b'?'));
            }
            Some(other) => out.push(other),
            None => out.push(b'\\'),
        }
    }
    out.into()
}

#[cfg(test)]
mod tests {
    use super::*;

    const A: &str = "0123456789abcdef0123456789abcdef01234567";
    const B: &str = "89abcdef0123456789abcdef0123456789abcdef";

    #[test]
    fn reads_hunks_commits_and_previous_versions() {
        let output = format!(
            "{A} 3 5 2\nauthor Ada\nauthor-mail <ada@example.com>\nauthor-time 1600000000\n\
             summary Edit\nprevious {B} old name.rs\nfilename new.rs\n\
             {B} 1 1 4\nauthor Bo\nauthor-mail <bo@example.com>\nauthor-time 1500000000\n\
             summary Add\nboundary\nfilename old name.rs\n{A} 9 7 1\nfilename new.rs\n"
        );
        let blame = parse_incremental(output.as_bytes()).unwrap();
        let lines: Vec<u32> = blame.hunks.iter().map(|hunk| hunk.line).collect();
        assert_eq!(lines, [1, 5, 7]);
        assert_eq!(blame.commits.len(), 2);
        let edit = &blame.commits[blame.hunks[1].commit];
        assert_eq!(edit.author_email, "ada@example.com");
        assert_eq!(
            edit.previous,
            Some((object_id(B.as_bytes()).unwrap(), "old name.rs".into()))
        );
        assert_eq!(blame.paths[blame.hunks[0].path], "old name.rs");
        assert_eq!(blame.hunks[2].original_line, 9);
    }

    #[test]
    fn unquotes_c_style_paths() {
        assert_eq!(unquote(br#""a\"b\\c\tx\303\251""#), "a\"b\\c\tx\u{e9}");
        assert_eq!(unquote(b"plain name"), "plain name");
    }

    #[test]
    fn rejects_garbage() {
        assert!(parse_incremental(b"not blame output\n").is_err());
    }
}

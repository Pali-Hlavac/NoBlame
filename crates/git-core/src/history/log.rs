//! Reading `git log --name-status` for one path: the commits that change it and how.

use std::path::Path;

use gix::ObjectId;
use gix::bstr::{BStr, BString, ByteSlice};
use tokio_util::sync::CancellationToken;

use super::{HistoryError, PathChange};
use crate::cli::Git;

/// Marks the commit id in `git log`'s output; file names never contain it.
const COMMIT_MARK: u8 = 0x01;

/// The commits `git log` lists for `path` from `starts`, with how each changed the path.
pub(super) async fn path_log(
    git: &Git,
    dir: &Path,
    starts: &[ObjectId],
    first_parent: bool,
    path: &BStr,
    cancel: &CancellationToken,
) -> Result<Vec<(ObjectId, PathChange)>, HistoryError> {
    if starts.is_empty() {
        return Ok(Vec::new());
    }
    let mut input = Vec::new();
    for start in starts {
        input.extend_from_slice(start.to_string().as_bytes());
        input.push(b'\n');
    }
    let mut command = git.command().current_dir(dir).read_only().args([
        "log",
        "--stdin",
        "--format=%x01%H",
        "-z",
        "--name-status",
        "--no-renames",
    ]);
    if first_parent {
        command = command.arg("--first-parent");
    }
    // `:(literal)`: a file named `a*b` is not a pattern.
    let mut spec = BString::from(":(literal)");
    spec.extend_from_slice(path);
    let spec = gix::path::from_bstr(spec.as_bstr())
        .map_err(|error| HistoryError::Gix(error.to_string()))?
        .into_owned();
    let output = command.paths([spec]).stdin(input).run(cancel).await?;
    Ok(parse_log(&output.stdout))
}

/// Reads `\x01<id>\0` records, each followed by `\n<status>\0<path>\0` pairs (none for a merge).
fn parse_log(output: &[u8]) -> Vec<(ObjectId, PathChange)> {
    let mut commits: Vec<(ObjectId, PathChange)> = Vec::new();
    let mut fields = output.split(|&byte| byte == 0);
    while let Some(field) = fields.next() {
        let field = field.trim_ascii_start();
        if let Some(hex) = field.strip_prefix(&[COMMIT_MARK]) {
            if let Ok(id) = ObjectId::from_hex(hex) {
                commits.push((id, PathChange::Merge));
            }
            continue;
        }
        let Some((_, change)) = commits.last_mut() else {
            continue;
        };
        let status = match field.first() {
            Some(b'A') => PathChange::Added,
            Some(b'D') => PathChange::Deleted,
            Some(_) => PathChange::Modified,
            None => continue,
        };
        // Skip the changed file's path; a folder's commit lists several files.
        fields.next();
        // A folder was added or deleted only if every file listed was.
        *change = match *change {
            PathChange::Merge => status,
            previous if previous == status => status,
            _ => PathChange::Modified,
        };
    }
    commits
}

#[cfg(test)]
mod tests {
    use super::*;

    const A: &str = "0123456789abcdef0123456789abcdef01234567";
    const B: &str = "89abcdef0123456789abcdef0123456789abcdef";

    #[test]
    fn reads_changes_and_merges() {
        let output = format!("\x01{A}\0\nA\0src/a.rs\0\x01{B}\0");
        let log = parse_log(output.as_bytes());
        assert_eq!(log.len(), 2);
        assert_eq!(log[0].1, PathChange::Added);
        assert_eq!(log[1].1, PathChange::Merge);
    }

    #[test]
    fn a_folder_was_added_only_if_every_file_was() {
        let output = format!("\x01{A}\0\nA\0src/a.rs\0\nM\0src/b.rs\0\x01{B}\0\nA\0src/a.rs\0");
        let log = parse_log(output.as_bytes());
        assert_eq!(log[0].1, PathChange::Modified);
        assert_eq!(log[1].1, PathChange::Added);
    }
}

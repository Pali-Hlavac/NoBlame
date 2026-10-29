//! Commits that change a path, found with `git rev-list`, so that git's history simplification
//! and its changed-path Bloom filters (written with the commit-graph file) apply.

use std::path::Path;

use gix::ObjectId;
use tokio_util::sync::CancellationToken;

use crate::cli::{Git, GitError};

/// The commits reachable from `tips` that change `path`, as
/// `git rev-list [--first-parent] <tips> -- <path>` lists them. `path` is a file, folder or
/// pathspec relative to the top of the working tree (`dir` for a bare repository). Tips go to
/// git on standard input, so tens of thousands of references fit.
pub async fn commits_changing(
    git: &Git,
    dir: &Path,
    tips: &[ObjectId],
    first_parent: bool,
    path: &str,
    cancel: &CancellationToken,
) -> Result<Vec<ObjectId>, GitError> {
    if tips.is_empty() {
        return Ok(Vec::new());
    }
    let mut input = Vec::with_capacity(tips.len() * (tips[0].as_bytes().len() * 2 + 1));
    for tip in tips {
        input.extend_from_slice(tip.to_string().as_bytes());
        input.push(b'\n');
    }
    let mut command = git
        .command()
        .current_dir(dir)
        .read_only()
        .args(["rev-list", "--stdin"]);
    if first_parent {
        command = command.arg("--first-parent");
    }
    let output = command.paths([path]).stdin(input).run(cancel).await?;
    Ok(parse_ids(&output.stdout))
}

/// One hex id per line; anything else is skipped.
fn parse_ids(output: &[u8]) -> Vec<ObjectId> {
    output
        .split(|&byte| byte == b'\n')
        .filter_map(|line| ObjectId::from_hex(line.trim_ascii()).ok())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_one_id_per_line() {
        let id = "0123456789abcdef0123456789abcdef01234567";
        let ids = parse_ids(format!("{id}\n\n{id}\r\nnot an id\n").as_bytes());
        assert_eq!(ids.len(), 2);
        assert_eq!(ids[0].to_string(), id);
    }
}

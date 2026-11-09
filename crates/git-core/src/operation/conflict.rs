//! The files with conflicts, read from the index's stages, and resolving one by taking a whole
//! side ("ours" or "theirs"). During a merge "ours" is the current branch; during a rebase it is
//! the branch being rebased onto, and "theirs" the commit being replayed (git's own naming).

use std::collections::BTreeMap;
use std::path::Path;

use gix::bstr::{BString, ByteSlice};
use tokio_util::sync::CancellationToken;

use super::OperationError;
use crate::cli::{Git, GitOutput};

/// How a file conflicts, from which index stages it has (1 base, 2 ours, 3 theirs).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConflictKind {
    /// Both sides changed it.
    BothModified,
    /// Both sides added it, differently.
    BothAdded,
    /// Our side deleted it; theirs changed it.
    DeletedByUs,
    /// Their side deleted it; ours changed it.
    DeletedByThem,
    /// Only our side added it (theirs added it under another name).
    AddedByUs,
    /// Only their side added it.
    AddedByThem,
    /// Both sides deleted (or renamed) it.
    BothDeleted,
}

impl ConflictKind {
    /// The kind for a file with these stages.
    fn from_stages(base: bool, ours: bool, theirs: bool) -> Self {
        match (base, ours, theirs) {
            (true, true, true) => Self::BothModified,
            (false, true, true) => Self::BothAdded,
            (true, false, true) => Self::DeletedByUs,
            (true, true, false) => Self::DeletedByThem,
            (false, true, false) => Self::AddedByUs,
            (false, false, true) => Self::AddedByThem,
            _ => Self::BothDeleted,
        }
    }

    /// Whether our side has the file.
    #[must_use]
    pub fn has_ours(self) -> bool {
        matches!(
            self,
            Self::BothModified | Self::BothAdded | Self::DeletedByThem | Self::AddedByUs
        )
    }

    /// Whether their side has the file.
    #[must_use]
    pub fn has_theirs(self) -> bool {
        matches!(
            self,
            Self::BothModified | Self::BothAdded | Self::DeletedByUs | Self::AddedByThem
        )
    }
}

/// A file with conflicts.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Conflict {
    /// Its path in the working tree, as git stores it.
    pub path: BString,
    /// Which sides have it.
    pub kind: ConflictKind,
}

/// Which side's version to keep.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Side {
    /// Stage 2: the current branch (during a rebase: the branch rebased onto).
    Ours,
    /// Stage 3: what comes in (the merged branch, the picked commit, the replayed commit).
    Theirs,
}

/// The conflicted files in `work_dir`, sorted by path (`git ls-files -u -z`). Read-only.
pub async fn conflicts(
    git: &Git,
    work_dir: &Path,
    cancel: &CancellationToken,
) -> Result<Vec<Conflict>, OperationError> {
    let output = git
        .command()
        .current_dir(work_dir)
        .read_only()
        .args(["ls-files", "-u", "-z"])
        .output(cancel)
        .await?;
    Ok(parse_unmerged(&checked(output)?.stdout))
}

/// `<mode> <id> <stage>\t<path>` records separated by NUL, a few per path.
fn parse_unmerged(bytes: &[u8]) -> Vec<Conflict> {
    let mut stages: BTreeMap<BString, [bool; 3]> = BTreeMap::new();
    for record in bytes.split(|byte| *byte == 0) {
        let Some((info, path)) = record.split_once_str("\t") else {
            continue;
        };
        let stage = info.rsplit(|byte| *byte == b' ').next();
        let index = match stage {
            Some(b"1") => 0,
            Some(b"2") => 1,
            Some(b"3") => 2,
            _ => continue,
        };
        stages.entry(BString::from(path)).or_default()[index] = true;
    }
    stages
        .into_iter()
        .map(|(path, [base, ours, theirs])| Conflict {
            path,
            kind: ConflictKind::from_stages(base, ours, theirs),
        })
        .collect()
}

/// Resolves the conflicted `paths` in `work_dir` with `side`'s whole version, and stages them:
/// `git checkout --ours|--theirs` then `git add`; where that side deleted the file, `git rm`.
/// Refused (nothing changed) when a path has no conflict.
pub async fn take_side(
    git: &Git,
    work_dir: &Path,
    paths: &[impl AsRef<[u8]>],
    side: Side,
    cancel: &CancellationToken,
) -> Result<(), OperationError> {
    let known = conflicts(git, work_dir, cancel).await?;
    let mut kept = Vec::new();
    let mut removed = Vec::new();
    for path in paths {
        let path = path.as_ref();
        let Some(conflict) = known.iter().find(|conflict| conflict.path == path) else {
            return Err(OperationError::NotApplicable(format!(
                "{} has no conflict (any more).",
                path.to_str_lossy()
            )));
        };
        let present = match side {
            Side::Ours => conflict.kind.has_ours(),
            Side::Theirs => conflict.kind.has_theirs(),
        };
        if present { &mut kept } else { &mut removed }.push(BString::from(path));
    }
    if !kept.is_empty() {
        let flag = match side {
            Side::Ours => "--ours",
            Side::Theirs => "--theirs",
        };
        let checkout = git
            .command()
            .current_dir(work_dir)
            .args(["checkout", flag])
            .pathspecs_on_stdin(&kept)
            .output(cancel)
            .await?;
        checked(checkout)?;
        let add = git
            .command()
            .current_dir(work_dir)
            .arg("add")
            .pathspecs_on_stdin(&kept)
            .output(cancel)
            .await?;
        checked(add)?;
    }
    if !removed.is_empty() {
        let remove = git
            .command()
            .current_dir(work_dir)
            .args(["rm", "--quiet"])
            .pathspecs_on_stdin(&removed)
            .output(cancel)
            .await?;
        checked(remove)?;
    }
    Ok(())
}

fn checked(output: GitOutput) -> Result<GitOutput, OperationError> {
    if output.success() {
        Ok(output)
    } else {
        Err(OperationError::Rejected {
            output: output.combined(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::{ConflictKind, parse_unmerged};

    #[test]
    fn reads_the_kind_from_the_stages() {
        let records = [
            "100644 aaa 1\tboth.txt",
            "100644 bbb 2\tboth.txt",
            "100644 ccc 3\tboth.txt",
            "100644 aaa 1\tgone ours.txt",
            "100644 ccc 3\tgone ours.txt",
            "100644 bbb 2\tnew.txt",
        ]
        .join("\0");
        let conflicts = parse_unmerged(records.as_bytes());
        let kinds: Vec<_> = conflicts
            .iter()
            .map(|conflict| (conflict.path.to_string(), conflict.kind))
            .collect();
        assert_eq!(
            kinds,
            vec![
                ("both.txt".to_owned(), ConflictKind::BothModified),
                ("gone ours.txt".to_owned(), ConflictKind::DeletedByUs),
                ("new.txt".to_owned(), ConflictKind::AddedByUs),
            ]
        );
        assert!(!ConflictKind::DeletedByUs.has_ours());
        assert!(ConflictKind::DeletedByUs.has_theirs());
    }
}

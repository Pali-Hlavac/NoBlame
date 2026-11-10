//! Parsing `git status --porcelain=v2 -z`. Each record is one NUL-terminated field; a rename
//! or copy is followed by its original path as another field. Paths may contain spaces, so a
//! record is split into its fixed fields and the path is the rest.

use gix::ObjectId;
use gix::bstr::{BString, ByteSlice};

use super::{
    FileState, MAX_STATUS_FILES, StatusError, StatusFile, SubmoduleChanges, WorkingTreeStatus,
};

/// Fields before the path: `1 XY sub mH mI mW hH hI`.
const ORDINARY_FIELDS: usize = 8;
/// `2 XY sub mH mI mW hH hI Xscore`.
const RENAMED_FIELDS: usize = 9;
/// `u XY sub m1 m2 m3 mW h1 h2 h3`.
const UNMERGED_FIELDS: usize = 10;

impl WorkingTreeStatus {
    /// Reads `git status --porcelain=v2 -z` output.
    pub fn parse(output: &[u8]) -> Result<Self, StatusError> {
        let mut status = Self::default();
        let mut fields = output
            .split(|&byte| byte == 0)
            .filter(|field| !field.is_empty());
        while let Some(record) = fields.next() {
            match record.first() {
                Some(b'1') => status.add_change(record, ORDINARY_FIELDS, None)?,
                Some(b'2') => {
                    let original = fields.next().ok_or_else(|| invalid(record))?;
                    status.add_change(record, RENAMED_FIELDS, Some(original.into()))?;
                }
                Some(b'u') => status.add_conflict(record)?,
                Some(b'?') => {
                    let path = record.get(2..).ok_or_else(|| invalid(record))?;
                    status.summary.untracked += 1;
                    status.summary.changes.added += 1;
                    status.unstaged.push(StatusFile {
                        path: path.into(),
                        previous_path: None,
                        state: FileState::Untracked,
                        old_id: None,
                        new_id: None,
                        in_worktree: true,
                        submodule: false,
                        submodule_changes: SubmoduleChanges::default(),
                    });
                }
                Some(b'!' | b'#') => {}
                _ => return Err(invalid(record)),
            }
        }
        for files in [&mut status.staged, &mut status.unstaged] {
            files.sort_by(|a, b| a.path.cmp(&b.path));
            files.truncate(MAX_STATUS_FILES);
        }
        Ok(status)
    }

    /// `1 XY ...` or `2 XY ...`: X is the index, Y the working tree, `.` means unchanged.
    fn add_change(
        &mut self,
        record: &[u8],
        fixed: usize,
        original: Option<BString>,
    ) -> Result<(), StatusError> {
        let (fields, path) = split_record(record, fixed)?;
        let [xy, sub, head_id, index_id] = [1, 2, 6, 7].map(|at| fields[at]);
        let (&[index, work_tree], submodule) = (xy, sub.first() == Some(&b'S')) else {
            return Err(invalid(record));
        };
        let (head_id, index_id) = (object_id(head_id, record)?, object_id(index_id, record)?);
        self.summary.changes.count_change(index, work_tree);
        if index != b'.' {
            self.summary.staged += 1;
            self.staged.push(StatusFile {
                path: path.into(),
                previous_path: original.clone(),
                state: state(index, record)?,
                old_id: head_id,
                new_id: index_id,
                in_worktree: false,
                submodule,
                submodule_changes: SubmoduleChanges::default(),
            });
        }
        if work_tree != b'.' {
            self.summary.unstaged += 1;
            let state = state(work_tree, record)?;
            self.unstaged.push(StatusFile {
                path: path.into(),
                // A staged rename's old name belongs to the staged side.
                previous_path: original.filter(|_| state == FileState::Renamed),
                state,
                old_id: index_id,
                new_id: None,
                in_worktree: state != FileState::Deleted,
                submodule,
                submodule_changes: submodule_changes(sub),
            });
        }
        Ok(())
    }

    /// `u XY sub m1 m2 m3 mW h1 h2 h3 path`: compared with "ours" (stage 2).
    fn add_conflict(&mut self, record: &[u8]) -> Result<(), StatusError> {
        let (fields, path) = split_record(record, UNMERGED_FIELDS)?;
        self.summary.conflicted += 1;
        self.summary.changes.changed += 1;
        self.unstaged.push(StatusFile {
            path: path.into(),
            previous_path: None,
            state: FileState::Conflicted,
            old_id: object_id(fields[8], record)?,
            new_id: None,
            // `mW` is 000000 when the file is not in the working tree.
            in_worktree: fields[6].iter().any(|&digit| digit != b'0'),
            submodule: fields[2].first() == Some(&b'S'),
            submodule_changes: SubmoduleChanges::default(),
        });
        Ok(())
    }
}

/// `S<c><m><u>`: `C` new commits, `M` changed files, `U` untracked files (`.` for none);
/// `N...` (not a submodule) has none.
fn submodule_changes(sub: &[u8]) -> SubmoduleChanges {
    match sub {
        [b'S', commit, modified, untracked] => SubmoduleChanges {
            new_commits: *commit == b'C',
            modified: *modified == b'M',
            untracked: *untracked == b'U',
        },
        _ => SubmoduleChanges::default(),
    }
}

/// The `fixed` space-separated fields of `record`, then the path (which may contain spaces).
fn split_record(record: &[u8], fixed: usize) -> Result<(Vec<&[u8]>, &[u8]), StatusError> {
    let mut parts = record.splitn(fixed + 1, |&byte| byte == b' ');
    let fields: Vec<&[u8]> = parts.by_ref().take(fixed).collect();
    match parts.next() {
        Some(path) if fields.len() == fixed && !path.is_empty() => Ok((fields, path)),
        _ => Err(invalid(record)),
    }
}

/// An object id field; all zeros means the file is absent there.
fn object_id(hex: &[u8], record: &[u8]) -> Result<Option<ObjectId>, StatusError> {
    let id = ObjectId::from_hex(hex).map_err(|_| invalid(record))?;
    Ok((!id.is_null()).then_some(id))
}

/// One status letter of `XY`.
fn state(letter: u8, record: &[u8]) -> Result<FileState, StatusError> {
    Ok(match letter {
        b'A' => FileState::Added,
        b'D' => FileState::Deleted,
        b'M' | b'T' => FileState::Modified,
        b'R' => FileState::Renamed,
        b'C' => FileState::Copied,
        _ => return Err(invalid(record)),
    })
}

fn invalid(record: &[u8]) -> StatusError {
    StatusError::Parse(record.to_str_lossy().into_owned())
}

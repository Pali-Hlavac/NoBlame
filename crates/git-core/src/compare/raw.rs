//! Reads `git diff --raw -z --no-abbrev` output into changed files. Each entry is
//! `:<old mode> <new mode> <old id> <new id> <status>[score]` and its path, then for renames
//! and copies the new path, each ending in NUL.

use gix::ObjectId;
use gix::bstr::{BString, ByteSlice};

use super::CompareError;
use crate::diff::{ChangeStatus, ChangedFile};

/// Mode of a submodule entry (a commit pointer).
const SUBMODULE_MODE: &[u8] = b"160000";

/// The changed files listed in `output`, in git's order.
pub(super) fn parse_raw(output: &[u8]) -> Result<Vec<ChangedFile>, CompareError> {
    let mut fields = output
        .split(|&byte| byte == 0)
        .filter(|field| !field.is_empty());
    let mut files = Vec::new();
    while let Some(header) = fields.next() {
        let bad = || CompareError::Parse(header.to_str_lossy().into_owned());
        let header = header.strip_prefix(b":").ok_or_else(bad)?;
        let parts: Vec<&[u8]> = header.split_str(" ").collect();
        let [old_mode, new_mode, old_id, new_id, status] = parts.as_slice() else {
            return Err(bad());
        };
        let mut path = || fields.next().map(BString::from).ok_or_else(bad);
        let (status, previous_path, path) = match status.first() {
            Some(b'A') => (ChangeStatus::Added, None, path()?),
            Some(b'D') => (ChangeStatus::Deleted, None, path()?),
            // T: the type changed (a file became a link); shown as a modification.
            Some(b'M' | b'T') => (ChangeStatus::Modified, None, path()?),
            Some(b'R') => (ChangeStatus::Renamed, Some(path()?), path()?),
            Some(b'C') => (ChangeStatus::Copied, Some(path()?), path()?),
            _ => return Err(bad()),
        };
        files.push(ChangedFile {
            path,
            previous_path,
            status,
            old_id: object_id(old_id).map_err(|()| bad())?,
            new_id: object_id(new_id).map_err(|()| bad())?,
            submodule: *old_mode == SUBMODULE_MODE || *new_mode == SUBMODULE_MODE,
        });
    }
    Ok(files)
}

/// The id, or `None` for git's all-zero id of a side where the file is absent.
fn object_id(hex: &[u8]) -> Result<Option<ObjectId>, ()> {
    let id = ObjectId::from_hex(hex).map_err(|_| ())?;
    Ok((!id.is_null()).then_some(id))
}

#[cfg(test)]
mod tests {
    use super::*;

    const A: &str = "1111111111111111111111111111111111111111";
    const B: &str = "2222222222222222222222222222222222222222";
    const ZERO: &str = "0000000000000000000000000000000000000000";

    fn id(hex: &str) -> Option<ObjectId> {
        ObjectId::from_hex(hex.as_bytes()).ok()
    }

    #[test]
    fn reads_every_status() {
        let output = format!(
            ":000000 100644 {ZERO} {A} A\0new.txt\0\
             :100644 000000 {A} {ZERO} D\0gone.txt\0\
             :100644 100755 {A} {B} M\0run.sh\0\
             :100644 100644 {A} {B} R086\0old name.rs\0new name.rs\0\
             :100644 100644 {A} {A} C100\0a.rs\0b.rs\0\
             :160000 160000 {A} {B} M\0vendor/lib\0"
        );
        let files = parse_raw(output.as_bytes()).unwrap();
        let summary: Vec<_> = files
            .iter()
            .map(|file| {
                (
                    file.status,
                    file.path.to_string(),
                    file.previous_path.as_ref().map(ToString::to_string),
                    file.submodule,
                )
            })
            .collect();
        assert_eq!(
            summary,
            [
                (ChangeStatus::Added, "new.txt".into(), None, false),
                (ChangeStatus::Deleted, "gone.txt".into(), None, false),
                (ChangeStatus::Modified, "run.sh".into(), None, false),
                (
                    ChangeStatus::Renamed,
                    "new name.rs".into(),
                    Some("old name.rs".into()),
                    false
                ),
                (
                    ChangeStatus::Copied,
                    "b.rs".into(),
                    Some("a.rs".into()),
                    false
                ),
                (ChangeStatus::Modified, "vendor/lib".into(), None, true),
            ]
        );
        assert_eq!((files[0].old_id, files[0].new_id), (None, id(A)));
        assert_eq!((files[1].old_id, files[1].new_id), (id(A), None));
        assert_eq!((files[3].old_id, files[3].new_id), (id(A), id(B)));
    }

    #[test]
    fn rejects_what_it_does_not_understand() {
        assert!(parse_raw(b"M\0file\0").is_err());
        assert!(parse_raw(format!(":100644 100644 {A} {B} X\0file\0").as_bytes()).is_err());
        assert!(parse_raw(format!(":100644 100644 {A} {B} R100\0only-one\0").as_bytes()).is_err());
        assert!(parse_raw(b"").unwrap().is_empty());
    }
}

#![allow(clippy::unwrap_used)]

use super::*;

const HEAD: &str = "1111111111111111111111111111111111111111";
const INDEX: &str = "2222222222222222222222222222222222222222";
const NULL: &str = "0000000000000000000000000000000000000000";

fn id(hex: &str) -> ObjectId {
    ObjectId::from_hex(hex.as_bytes()).unwrap()
}

fn parse(records: &[String]) -> WorkingTreeStatus {
    let mut output = Vec::new();
    for record in records {
        output.extend_from_slice(record.as_bytes());
        output.push(0);
    }
    WorkingTreeStatus::parse(&output).unwrap()
}

#[test]
fn counts_each_kind_of_record() {
    let status = parse(&[
        "# branch.oid abc".into(),
        format!("1 M. N... 100644 100644 100644 {HEAD} {INDEX} staged.txt"),
        format!("1 .M N... 100644 100644 100644 {HEAD} {HEAD} changed.txt"),
        format!("1 MM N... 100644 100644 100644 {HEAD} {INDEX} both.txt"),
        format!("2 R. N... 100644 100644 100644 {HEAD} {HEAD} R100 new name.txt"),
        "old name.txt".into(),
        format!("u UU N... 100644 100644 100644 100644 {HEAD} {INDEX} {HEAD} conflict.txt"),
        "? untracked/one.txt".into(),
        "! ignored.log".into(),
    ]);
    assert_eq!(
        status.summary,
        StatusSummary {
            staged: 3,
            unstaged: 2,
            untracked: 1,
            conflicted: 1,
            changes: ChangeCounts {
                added: 1,
                changed: 5,
                deleted: 0
            }
        }
    );
    assert_eq!(status.staged.len(), 3);
    assert_eq!(status.unstaged.len(), 4);
}

#[test]
fn staged_files_compare_head_with_the_index() {
    let status = parse(&[
        format!("1 A. N... 000000 100644 100644 {NULL} {INDEX} added.txt"),
        format!("2 R. N... 100644 100644 100644 {HEAD} {INDEX} R90 new name.txt"),
        "old name.txt".into(),
    ]);
    let [added, renamed] = &status.staged[..] else {
        panic!("two staged files expected")
    };
    assert_eq!(added.state, FileState::Added);
    assert_eq!((added.old_id, added.new_id), (None, Some(id(INDEX))));
    assert_eq!(renamed.path, "new name.txt");
    assert_eq!(renamed.previous_path, Some("old name.txt".into()));
    assert_eq!(renamed.state, FileState::Renamed);
    assert!(!renamed.in_worktree);
    assert!(status.unstaged.is_empty());
}

#[test]
fn unstaged_files_compare_the_index_with_the_working_tree() {
    let status = parse(&[
        format!("1 MD N... 100644 100644 000000 {HEAD} {INDEX} gone.txt"),
        format!("1 .M SC.U 160000 160000 160000 {HEAD} {HEAD} module"),
        "? z new.txt".into(),
    ]);
    let [gone, module, new] = &status.unstaged[..] else {
        panic!("three unstaged files expected")
    };
    assert_eq!(gone.state, FileState::Deleted);
    assert_eq!(gone.old_id, Some(id(INDEX)));
    assert!(!gone.in_worktree);
    assert!(module.submodule && module.in_worktree);
    assert!(module.submodule_changes.new_commits && module.submodule_changes.untracked);
    assert!(!module.submodule_changes.modified);
    assert_eq!(new.path, "z new.txt");
    assert_eq!((new.state, new.old_id), (FileState::Untracked, None));
    assert!(new.in_worktree);
    assert_eq!(status.staged[0].state, FileState::Modified);
}

#[test]
fn conflicts_compare_ours_with_the_working_tree() {
    let status = parse(&[format!(
        "u DU N... 100644 000000 100644 000000 {HEAD} {NULL} {INDEX} both deleted.txt"
    )]);
    let conflict = &status.unstaged[0];
    assert_eq!(conflict.path, "both deleted.txt");
    assert_eq!(conflict.state, FileState::Conflicted);
    assert_eq!(conflict.old_id, None);
    assert!(!conflict.in_worktree);
}

#[test]
fn lists_are_sorted_and_capped() {
    let records: Vec<String> = (0..=MAX_STATUS_FILES)
        .rev()
        .map(|n| format!("? file{n:05}.txt"))
        .collect();
    let status = parse(&records);
    assert_eq!(status.summary.untracked as usize, MAX_STATUS_FILES + 1);
    assert_eq!(status.unstaged.len(), MAX_STATUS_FILES);
    assert_eq!(status.unstaged[0].path, "file00000.txt");
}

#[test]
fn empty_output_is_clean() {
    assert!(WorkingTreeStatus::parse(b"").unwrap().summary.is_clean());
}

#[test]
fn rejects_other_formats() {
    assert!(WorkingTreeStatus::parse(b" M file.txt\0").is_err());
    assert!(WorkingTreeStatus::parse(b"1 M. N... 100644\0").is_err());
}

#[test]
fn counts_each_file_once_by_what_happened_since_head() {
    let status = parse(&[
        format!("1 A. N... 000000 100644 100644 {NULL} {INDEX} added.txt"),
        format!("1 AM N... 000000 100644 100644 {NULL} {INDEX} added then changed.txt"),
        format!("1 .A N... 000000 000000 100644 {NULL} {NULL} intent to add.txt"),
        format!("1 D. N... 100644 000000 000000 {HEAD} {NULL} removed.txt"),
        format!("1 .D N... 100644 100644 000000 {HEAD} {HEAD} gone.txt"),
        format!("1 MD N... 100644 100644 000000 {HEAD} {INDEX} changed then gone.txt"),
        format!("1 MM N... 100644 100644 100644 {HEAD} {INDEX} changed twice.txt"),
        format!("1 .T N... 100644 100644 120000 {HEAD} {HEAD} now a link"),
        format!("2 RM N... 100644 100644 100644 {HEAD} {INDEX} R90 moved.txt"),
        "old.txt".into(),
        format!("u AA N... 000000 100644 100644 100644 {NULL} {INDEX} {HEAD} both added.txt"),
        "? new.txt".into(),
    ]);
    assert_eq!(
        status.summary.changes,
        ChangeCounts {
            added: 4,
            changed: 4,
            deleted: 3
        }
    );
}

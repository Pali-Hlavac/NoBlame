use super::*;

fn paths() -> WatchPaths {
    WatchPaths {
        git_dir: PathBuf::from("/repo/.git"),
        common_dir: PathBuf::from("/repo/.git"),
        work_dir: Some(PathBuf::from("/repo")),
    }
}

fn kind(path: &str) -> Option<ChangeKind> {
    classify(&paths(), Path::new(path))
}

#[test]
fn refs_and_head_are_ref_changes() {
    assert_eq!(kind("/repo/.git/HEAD"), Some(ChangeKind::Refs));
    assert_eq!(kind("/repo/.git/packed-refs"), Some(ChangeKind::Refs));
    assert_eq!(kind("/repo/.git/refs/heads/main"), Some(ChangeKind::Refs));
    assert_eq!(kind("/repo/.git/refs/stash"), Some(ChangeKind::Refs));
}

#[test]
fn the_config_is_a_config_change() {
    assert_eq!(kind("/repo/.git/config"), Some(ChangeKind::Config));
    assert_eq!(kind("/repo/.git/config.worktree"), Some(ChangeKind::Config));
    assert_eq!(kind("/repo/.git/config.lock"), None);
}

#[test]
fn the_index_and_files_are_work_tree_changes() {
    assert_eq!(kind("/repo/.git/index"), Some(ChangeKind::WorkTree));
    assert_eq!(kind("/repo/src/main.rs"), Some(ChangeKind::WorkTree));
}

#[test]
fn objects_logs_and_locks_are_ignored() {
    assert_eq!(kind("/repo/.git/objects/ab/cdef"), None);
    assert_eq!(kind("/repo/.git/logs/HEAD"), None);
    assert_eq!(kind("/repo/.git/index.lock"), None);
    assert_eq!(kind("/repo/.git/refs/heads/main.lock"), None);
    assert_eq!(kind("/elsewhere/file"), None);
}

#[test]
fn linked_work_trees_keep_refs_in_the_common_dir() {
    let paths = WatchPaths {
        git_dir: PathBuf::from("/main/.git/worktrees/wt"),
        common_dir: PathBuf::from("/main/.git"),
        work_dir: Some(PathBuf::from("/wt")),
    };
    let kind = |path: &str| classify(&paths, Path::new(path));
    assert_eq!(kind("/main/.git/worktrees/wt/HEAD"), Some(ChangeKind::Refs));
    assert_eq!(
        kind("/main/.git/worktrees/wt/index"),
        Some(ChangeKind::WorkTree)
    );
    assert_eq!(kind("/main/.git/refs/heads/topic"), Some(ChangeKind::Refs));
    assert_eq!(kind("/wt/file.txt"), Some(ChangeKind::WorkTree));
    assert_eq!(
        watch_roots(&paths),
        [PathBuf::from("/wt"), PathBuf::from("/main/.git")]
    );
}

#[test]
fn a_normal_repository_needs_one_root() {
    assert_eq!(watch_roots(&paths()), [PathBuf::from("/repo")]);
}

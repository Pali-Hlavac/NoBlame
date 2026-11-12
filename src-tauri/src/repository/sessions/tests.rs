//! Sessions belong to the window that opened them.

use super::*;

fn empty_repository(dir: &std::path::Path) -> Repository {
    let status = std::process::Command::new("git")
        .args(["init", "--quiet"])
        .current_dir(dir)
        .status()
        .unwrap();
    assert!(status.success());
    Repository::discover(dir).unwrap()
}

#[test]
fn closing_a_window_closes_only_its_sessions() {
    let dir = tempfile::tempdir().unwrap();
    let repo = empty_repository(dir.path());
    let sessions = RepoSessions::new(GraphCache::new(None));
    let (main, _) = sessions.insert(repo.clone(), "main");
    let (task, _) = sessions.insert(repo.clone(), "task-1");
    let (second, _) = sessions.insert(repo, "task-1");

    assert_eq!(sessions.remove_owned_by("task-1"), 2);
    assert!(sessions.get(main).is_ok());
    assert!(sessions.get(task).is_err());
    assert!(sessions.get(second).is_err());
    assert_eq!(sessions.remove_owned_by("task-1"), 0);
}

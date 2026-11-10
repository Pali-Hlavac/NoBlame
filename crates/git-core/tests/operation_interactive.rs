//! The interactive rebase with NoBlame's todo list, through the real `git`.
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod support;

use std::fs;

use git_core::cli::Git;
use git_core::operation::{
    InteractiveOutcome, TodoAction, TodoStep, interactive_plan, rebase_interactive,
};
use support::Fixture;
use tokio_util::sync::CancellationToken;

fn git() -> Git {
    Git::locate().expect("tests need git on PATH")
}

fn cancel() -> CancellationToken {
    CancellationToken::new()
}

/// `first`, then `add a`, `fixup! add a`, `change b`, `change c` on main.
fn history() -> Fixture {
    let fixture = Fixture::new();
    for (key, value) in [
        ("user.name", "Ada Lovelace"),
        ("user.email", "ada@example.com"),
        ("core.autocrlf", "false"),
    ] {
        fixture.git(&["config", key, value]);
    }
    let dir = fixture.path();
    let commit = |file: &str, text: &str, message: &str| {
        fs::write(dir.join(file), text).unwrap();
        fixture.git(&["add", "."]);
        fixture.commit(message);
    };
    commit("b.txt", "b\n", "first");
    commit("a.txt", "a\n", "add a");
    commit("a.txt", "a fixed\n", "fixup! add a");
    commit("b.txt", "b changed\n", "change b");
    commit("c.txt", "c\n", "change c");
    fixture
}

fn step(action: TodoAction, commit: &str, message: Option<&str>) -> TodoStep {
    TodoStep {
        action,
        commit: commit.to_owned(),
        message: message.map(str::to_owned),
    }
}

#[tokio::test]
async fn rewords_fixes_up_and_drops() {
    let fixture = history();
    let dir = fixture.path();
    let plan = interactive_plan(&git(), &dir, "HEAD~3", &cancel())
        .await
        .unwrap();
    let subjects: Vec<_> = plan.commits.iter().map(|c| c.message.as_str()).collect();
    assert_eq!(subjects, ["add a", "fixup! add a", "change b", "change c"]);
    assert_eq!(
        plan.base.as_deref(),
        Some(fixture.git(&["rev-parse", "HEAD~4"]).as_str())
    );
    assert_eq!((plan.merges, plan.published), (0, 0));

    let ids: Vec<_> = plan.commits.iter().map(|c| c.id.as_str()).collect();
    let steps = [
        step(
            TodoAction::Reword,
            ids[0],
            Some("Add a, it's reworded\n\nWith a body: $HOME `stays` as typed."),
        ),
        step(TodoAction::Fixup, ids[1], None),
        step(TodoAction::Drop, ids[2], None),
        step(TodoAction::Pick, ids[3], None),
    ];
    let (outcome, _) =
        rebase_interactive(&git(), &dir, plan.base.as_deref(), &steps, false, &cancel())
            .await
            .unwrap();
    assert_eq!(outcome, InteractiveOutcome::Rebased);
    assert_eq!(
        fixture.git(&["log", "--format=%s", "HEAD~2..HEAD"]),
        "change c\nAdd a, it's reworded"
    );
    assert_eq!(
        fixture.git(&["log", "-1", "--format=%b", "HEAD~1"]),
        "With a body: $HOME `stays` as typed."
    );
    assert_eq!(fs::read_to_string(dir.join("a.txt")).unwrap(), "a fixed\n");
    assert_eq!(fs::read_to_string(dir.join("b.txt")).unwrap(), "b\n");
    assert_eq!(
        fixture.git(&["log", "-1", "--format=%an", "HEAD~1"]),
        "Ada Lovelace"
    );
}

#[tokio::test]
async fn stops_at_an_edit_and_rebases_from_the_root() {
    let fixture = history();
    let dir = fixture.path();
    let plan = interactive_plan(&git(), &dir, "HEAD~1", &cancel())
        .await
        .unwrap();
    let steps = [
        step(TodoAction::Edit, &plan.commits[0].id, None),
        step(TodoAction::Pick, &plan.commits[1].id, None),
    ];
    let (outcome, output) =
        rebase_interactive(&git(), &dir, plan.base.as_deref(), &steps, false, &cancel())
            .await
            .unwrap();
    assert_eq!(outcome, InteractiveOutcome::Stopped, "{output}");
    assert!(dir.join(".git/rebase-merge").exists());
    fixture.git(&["-c", "core.editor=true", "rebase", "--continue"]);

    let plan = interactive_plan(&git(), &dir, "HEAD~4", &cancel())
        .await
        .unwrap();
    assert_eq!(plan.base, None);
    let mut steps: Vec<_> = plan
        .commits
        .iter()
        .map(|c| step(TodoAction::Pick, &c.id, None))
        .collect();
    steps[1].action = TodoAction::Squash;
    steps[0].message = Some("first and a".to_owned());
    let (outcome, _) = rebase_interactive(&git(), &dir, None, &steps, false, &cancel())
        .await
        .unwrap();
    assert_eq!(outcome, InteractiveOutcome::Rebased);
    assert_eq!(fixture.git(&["rev-list", "--count", "HEAD"]), "4");
    assert_eq!(
        fixture.git(&["log", "--format=%s", "-1", "HEAD~3"]),
        "first and a"
    );
}

#[tokio::test]
async fn refuses_a_commit_not_on_the_branch() {
    let fixture = history();
    let dir = fixture.path();
    fixture.git(&["switch", "-q", "-c", "side", "HEAD~2"]);
    fs::write(dir.join("side.txt"), "side\n").unwrap();
    fixture.git(&["add", "."]);
    fixture.commit("side");
    let result = interactive_plan(&git(), &dir, "main", &cancel()).await;
    assert!(result.is_err());
}

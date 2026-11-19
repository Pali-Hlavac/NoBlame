use super::{KeyChange, PlanError, StepAction, describe_plan, plan_changes, quote, steps_for};
use crate::config::scoped::{Scope, ScopedEntry};

fn entry(scope: Scope, key: &str, value: &str) -> ScopedEntry {
    ScopedEntry {
        scope,
        file: None,
        key: key.into(),
        value: value.into(),
    }
}

fn change(key: &str, before: &[&str], after: &[&str]) -> KeyChange {
    KeyChange {
        key: key.into(),
        before: before.iter().map(|v| (*v).to_owned()).collect(),
        after: after.iter().map(|v| (*v).to_owned()).collect(),
    }
}

#[test]
fn plans_only_what_changes_and_compares_local_values_only() {
    let current = [
        entry(Scope::Global, "remote.origin.tagopt", "--tags"),
        entry(Scope::Local, "remote.origin.prune", "true"),
    ];
    let plan = plan_changes(
        &current,
        &[
            change("remote.origin.tagOpt", &[], &["--no-tags"]),
            change("remote.origin.prune", &["true"], &["true"]),
        ],
    )
    .unwrap();
    assert_eq!(plan.len(), 1);
    assert_eq!(plan[0].after, ["--no-tags"]);
    assert_eq!(
        describe_plan(&plan),
        ["git config --local --replace-all remote.origin.tagOpt --no-tags"]
    );
}

#[test]
fn refuses_when_the_values_changed_meanwhile() {
    let current = [entry(Scope::Local, "remote.origin.url", "https://h/b")];
    let error = plan_changes(
        &current,
        &[change(
            "remote.origin.url",
            &["https://h/a"],
            &["https://h/c"],
        )],
    )
    .unwrap_err();
    assert!(matches!(error, PlanError::Changed { .. }), "{error}");
}

#[test]
fn keeps_hidden_passwords_and_refuses_new_hidden_ones() {
    let current = [
        entry(Scope::Local, "remote.origin.pushurl", "https://ada:t0k@h/a"),
        entry(Scope::Local, "remote.origin.pushurl", "https://h/b"),
    ];
    let shown = ["https://ada:***@h/a", "https://h/b"];
    let plan = plan_changes(
        &current,
        &[change(
            "remote.origin.pushurl",
            &shown,
            &["https://ada:***@h/a", "https://h/c"],
        )],
    )
    .unwrap();
    assert_eq!(plan[0].after, ["https://ada:t0k@h/a", "https://h/c"]);
    // The secret never appears in what is shown.
    assert!(
        describe_plan(&plan)
            .iter()
            .all(|line| !line.contains("t0k"))
    );
    let error = plan_changes(
        &current,
        &[change(
            "remote.origin.pushurl",
            &shown,
            &["https://eve:***@h/a"],
        )],
    )
    .unwrap_err();
    assert!(matches!(error, PlanError::HiddenValue { .. }), "{error}");
}

#[test]
fn writes_several_values_as_a_whole() {
    let had = ["a".to_owned()];
    assert_eq!(steps_for(&had, &[]), [StepAction::UnsetAll]);
    assert_eq!(
        steps_for(&had, &["b".into()]),
        [StepAction::ReplaceAll("b".into())]
    );
    assert_eq!(
        steps_for(&had, &["b".into(), "c".into()]),
        [
            StepAction::UnsetAll,
            StepAction::Add("b".into()),
            StepAction::Add("c".into())
        ]
    );
    assert_eq!(
        steps_for(&[], &["b".into(), "c".into()]),
        [StepAction::Add("b".into()), StepAction::Add("c".into())]
    );
}

#[test]
fn quotes_what_a_shell_would_split() {
    assert_eq!(quote("refs/heads/main"), "refs/heads/main");
    // A shell would expand `*`.
    assert_eq!(
        quote("+refs/heads/*:refs/x/*"),
        "\"+refs/heads/*:refs/x/*\""
    );
    assert_eq!(quote("a b"), "\"a b\"");
    assert_eq!(quote(""), "\"\"");
    assert_eq!(quote("say \"hi\""), "\"say \\\"hi\\\"\"");
}

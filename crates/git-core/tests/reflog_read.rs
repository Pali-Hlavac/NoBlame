//! Reading reflogs written by the real `git`.
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod support;

use std::fs;

use git_core::reflog::{ReflogError, reflog, reflog_references};
use support::Fixture;

#[test]
fn reads_head_and_branch_reflogs_newest_first() {
    let fixture = Fixture::new();
    for (key, value) in [
        ("user.name", "Ada Lovelace"),
        ("user.email", "ada@example.com"),
    ] {
        fixture.git(&["config", key, value]);
    }
    let dir = fixture.path();
    for (text, message) in [("1\n", "one"), ("2\n", "two")] {
        fs::write(dir.join("file.txt"), text).unwrap();
        fixture.git(&["add", "."]);
        fixture.commit(message);
    }
    let two = fixture.git(&["rev-parse", "HEAD"]);
    fixture.git(&["reset", "-q", "--hard", "HEAD~1"]);
    fixture.git(&["switch", "-q", "-c", "topic"]);

    let repo = gix::open(&dir).unwrap();
    let names = reflog_references(&repo).unwrap();
    assert_eq!(names, ["HEAD", "refs/heads/main", "refs/heads/topic"]);

    let head = reflog(&repo, "HEAD").unwrap();
    assert!(!head.truncated);
    let messages: Vec<_> = head.entries.iter().map(|e| e.message.as_str()).collect();
    assert_eq!(
        messages,
        [
            "checkout: moving from main to topic",
            "reset: moving to HEAD~1",
            "commit: two",
            "commit (initial): one",
        ]
    );
    assert_eq!(head.entries[1].old_id, two);
    assert_eq!(head.entries[1].index, 1);
    assert_eq!(head.entries[0].committer, "Ada Lovelace");

    let main = reflog(&repo, "refs/heads/main").unwrap();
    assert_eq!(main.entries.len(), 3);
    assert!(matches!(
        reflog(&repo, "refs/tags/v1"),
        Err(ReflogError::NotFound(_))
    ));
}

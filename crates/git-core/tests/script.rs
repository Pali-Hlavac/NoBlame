//! A user script runs as git with its placeholders filled in, each value one argument.
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod support;

use git_core::cli::Git;
use git_core::script::{ScriptValues, script_command};
use support::Fixture;
use tokio_util::sync::CancellationToken;

#[tokio::test]
async fn a_script_tags_the_commit_it_runs_on() {
    let fixture = Fixture::new();
    let sha = fixture.commit("Fix the parser");
    fixture.commit("Later");
    let dir = fixture.path();
    let values = ScriptValues {
        sha: sha.clone(),
        subject: "Fix the parser".into(),
        branch: Some("main".into()),
        repo: dir.display().to_string(),
    };
    let git = Git::locate().unwrap();
    let command = script_command(&git, &dir, "git tag done-{short} {sha}", &values).unwrap();
    let output = command.output(&CancellationToken::new()).await.unwrap();
    assert!(output.success(), "{}", output.combined());
    assert_eq!(
        fixture.git(&["rev-parse", &format!("done-{}", &sha[..8])]),
        sha
    );
}

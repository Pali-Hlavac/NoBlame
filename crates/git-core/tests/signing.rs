//! Checking commit signatures with the real git, using SSH keys (made with `ssh-keygen`, no
//! keyring needed). Skipped when `ssh-keygen` is not installed.
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod support;

use std::path::Path;
use std::process::Command;

use git_core::cli::Git;
use git_core::diff::parse_object_id;
use git_core::repo::Repository;
use git_core::signing::{SignatureFormat, Verdict, verify_commit};
use support::Fixture;
use tokio_util::sync::CancellationToken;

/// Makes an unencrypted ed25519 key `name` beside the repository; `None` without `ssh-keygen`.
fn ssh_key(fixture: &Fixture, name: &str) -> Option<String> {
    let path = fixture.sibling(name);
    let made = Command::new("ssh-keygen")
        .args(["-q", "-t", "ed25519", "-N", "", "-C", name, "-f"])
        .arg(&path)
        .status()
        .is_ok_and(|status| status.success());
    made.then(|| path.to_string_lossy().replace('\\', "/"))
}

fn signed_commit(fixture: &Fixture, key: &str, message: &str) -> String {
    let key = format!("user.signingkey={key}");
    fixture.git(&[
        "-c",
        "gpg.format=ssh",
        "-c",
        &key,
        "commit",
        "--quiet",
        "--allow-empty",
        "-S",
        "-m",
        message,
    ]);
    fixture.git(&["rev-parse", "HEAD"])
}

fn allow_signer(fixture: &Fixture, principal: &str, key: &str) {
    let public = std::fs::read_to_string(format!("{key}.pub")).unwrap();
    let lines = format!("{principal} {public}");
    let file = fixture.sibling("allowed_signers");
    std::fs::write(&file, lines).unwrap();
    let file = file.to_string_lossy().replace('\\', "/");
    fixture.git(&["config", "gpg.ssh.allowedSignersFile", &file]);
}

async fn check(dir: &Path, id: &str) -> Option<git_core::signing::SignatureCheck> {
    let repo = Repository::discover(dir).unwrap();
    verify_commit(
        &Git::locate().unwrap(),
        dir,
        &repo.thread_safe(),
        parse_object_id(id).unwrap(),
        &CancellationToken::new(),
    )
    .await
    .unwrap()
}

#[tokio::test]
async fn ssh_signatures_are_checked_against_the_allowed_signers() {
    let fixture = Fixture::new();
    let Some(key) = ssh_key(&fixture, "ada_key") else {
        eprintln!("ssh-keygen not found; skipped");
        return;
    };
    let other = ssh_key(&fixture, "other_key").unwrap();
    let unsigned = fixture.commit("unsigned");
    let signed = signed_commit(&fixture, &key, "signed");
    let dir = fixture.path();

    assert_eq!(check(&dir, &unsigned).await, None);

    // Without allowed signers git does not even report the signature.
    let unchecked = check(&dir, &signed).await.unwrap();
    assert_eq!(unchecked.format, SignatureFormat::Ssh);
    assert_eq!(unchecked.verdict, Verdict::CannotCheck);
    assert!(
        unchecked.message.contains("allowedSignersFile"),
        "{}",
        unchecked.message
    );

    allow_signer(&fixture, "ada@example.com", &key);
    let good = check(&dir, &signed).await.unwrap();
    assert_eq!(good.verdict, Verdict::Good);
    assert_eq!(good.signer.as_deref(), Some("ada@example.com"));
    assert!(
        good.fingerprint
            .as_deref()
            .is_some_and(|f| f.starts_with("SHA256:"))
    );

    allow_signer(&fixture, "someone@example.com", &other);
    let unknown = check(&dir, &signed).await.unwrap();
    assert_eq!(unknown.verdict, Verdict::UnknownValidity);
    assert_eq!(unknown.signer, None);
}

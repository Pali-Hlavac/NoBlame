//! Creating patches, checking and applying them (`git apply`, `git am`), and archives.
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod support;

use std::fs;
use std::path::PathBuf;

use git_core::cli::Git;
use git_core::patch::{
    AmOutcome, ApplyOutcome, ArchiveFormat, PatchCommits, PatchContents, PatchCount, PatchError,
    PatchFit, apply_mailbox, apply_patches, archive_command, check_patches, count_patches,
    read_patch_file, write_patch_file, write_patch_folder,
};
use support::Fixture;
use tokio_util::sync::CancellationToken;

fn git() -> Git {
    Git::locate().expect("tests need git on PATH")
}

const LINES: &str = "one\ntwo\nthree\nfour\nfive\nsix\nseven\n";

/// `main`: base (f.txt), "Change two", "Change six, add g"; `other` branches off at base.
fn series() -> Fixture {
    let fixture = Fixture::new();
    // The commands under test run with this process's environment: `git am` needs an identity,
    // no signing, and Git for Windows' system config would turn line endings into CRLF.
    fixture.git(&["config", "user.name", "Ada Lovelace"]);
    fixture.git(&["config", "user.email", "ada@example.com"]);
    fixture.git(&["config", "core.autocrlf", "false"]);
    fixture.git(&["config", "commit.gpgSign", "false"]);
    let path = fixture.path();
    fs::write(path.join("f.txt"), LINES).unwrap();
    fixture.git(&["add", "."]);
    fixture.commit("base");
    fixture.git(&["branch", "other"]);
    fs::write(path.join("f.txt"), LINES.replace("two", "TWO")).unwrap();
    fixture.git(&["commit", "--quiet", "-am", "Change two"]);
    fs::write(
        path.join("f.txt"),
        LINES.replace("two", "TWO").replace("six", "SIX"),
    )
    .unwrap();
    fs::write(path.join("g.txt"), "new\n").unwrap();
    fixture.git(&["add", "."]);
    fixture.git(&["commit", "--quiet", "-m", "Change six, add g"]);
    fixture
}

fn range(base: &str) -> PatchCommits {
    PatchCommits {
        tip: "main".into(),
        base: Some(base.into()),
    }
}

#[tokio::test]
async fn patches_are_counted_and_written() {
    let fixture = series();
    let (git, dir, cancel) = (git(), fixture.path(), CancellationToken::new());
    let count = count_patches(&git, &dir, &range("other"), &cancel)
        .await
        .unwrap();
    assert_eq!(
        count,
        PatchCount {
            commits: 2,
            merges: 0
        }
    );
    let one = PatchCommits {
        tip: "main~1".into(),
        base: None,
    };
    let count = count_patches(&git, &dir, &one, &cancel).await.unwrap();
    assert_eq!(
        count,
        PatchCount {
            commits: 1,
            merges: 0
        }
    );
    let missing = count_patches(&git, &dir, &range("nope"), &cancel).await;
    assert!(matches!(missing, Err(PatchError::Invalid(message)) if message.contains("nope")));

    let file = fixture.sibling("series.patch");
    write_patch_file(&git, &dir, &range("other"), &file, &cancel)
        .await
        .unwrap();
    let PatchContents::Mailbox(mails) = read_patch_file(&file).unwrap() else {
        panic!("expected a mailbox");
    };
    let subjects: Vec<_> = mails.iter().map(|mail| mail.subject.as_str()).collect();
    assert_eq!(subjects, ["Change two", "Change six, add g"]);

    let folder = fixture.sibling("out");
    fs::create_dir(&folder).unwrap();
    let written = write_patch_folder(&git, &dir, &range("other"), &folder, &cancel)
        .await
        .unwrap();
    let names: Vec<_> = written
        .iter()
        .map(|path| path.file_name().unwrap().to_string_lossy().into_owned())
        .collect();
    assert_eq!(
        names,
        ["0001-Change-two.patch", "0002-Change-six-add-g.patch"]
    );
    // Writing again would replace them: refused, nothing written.
    fs::remove_file(&written[1]).unwrap();
    let again = write_patch_folder(&git, &dir, &range("other"), &folder, &cancel).await;
    assert!(
        matches!(again, Err(PatchError::Invalid(message)) if message.contains("0001-Change-two.patch"))
    );
    assert!(!written[1].exists());
}

#[tokio::test]
async fn patches_are_checked_then_applied() {
    let fixture = series();
    let (git, dir, cancel) = (git(), fixture.path(), CancellationToken::new());
    let folder = fixture.sibling("out");
    fs::create_dir(&folder).unwrap();
    let files = write_patch_folder(&git, &dir, &range("other"), &folder, &cancel)
        .await
        .unwrap();
    fixture.git(&["checkout", "--quiet", "other"]);

    let check = check_patches(&git, &dir, &files, false, &cancel)
        .await
        .unwrap();
    assert_eq!(check.fit, PatchFit::Clean);
    let paths: Vec<_> = check.paths.iter().map(|path| path.path.as_str()).collect();
    assert_eq!(paths, ["f.txt", "g.txt"]);
    assert_eq!(
        (check.paths[0].added, check.paths[0].removed),
        (Some(2), Some(2))
    );

    // A change in the patch's context: only a three-way merge applies it, cleanly.
    fs::write(dir.join("f.txt"), LINES.replace("five", "FIVE")).unwrap();
    fixture.git(&["commit", "--quiet", "-am", "Change five"]);
    let first = &files[..1];
    let check = check_patches(&git, &dir, first, false, &cancel)
        .await
        .unwrap();
    assert_eq!(check.fit, PatchFit::ThreeWay);
    let (outcome, _) = apply_patches(&git, &dir, first, &cancel).await.unwrap();
    assert_eq!(outcome, ApplyOutcome::Merged);
    let merged = fs::read_to_string(dir.join("f.txt")).unwrap();
    assert!(merged.contains("TWO\nthree\nfour\nFIVE"), "{merged}");
    fixture.git(&["reset", "--quiet", "--hard"]);

    // A change on the next line: the merge leaves conflicts.
    fs::write(dir.join("f.txt"), LINES.replace("three", "THREE")).unwrap();
    fixture.git(&["commit", "--quiet", "-am", "Change three"]);
    let check = check_patches(&git, &dir, first, false, &cancel)
        .await
        .unwrap();
    assert_eq!(check.fit, PatchFit::Conflicts);
    let (outcome, _) = apply_patches(&git, &dir, first, &cancel).await.unwrap();
    assert_eq!(outcome, ApplyOutcome::Conflicts);
    assert!(fixture.git(&["status", "--porcelain"]).contains("UU f.txt"));
    fixture.git(&["reset", "--quiet", "--hard"]);

    // Not a patch at all.
    let notes = fixture.sibling("notes.txt");
    fs::write(&notes, "just notes\n").unwrap();
    let check = check_patches(&git, &dir, &[notes], false, &cancel)
        .await
        .unwrap();
    assert!(matches!(check.fit, PatchFit::Fails { .. }));
}

#[tokio::test]
async fn mails_become_commits_or_stop_on_a_conflict() {
    let fixture = series();
    let (git, dir, cancel) = (git(), fixture.path(), CancellationToken::new());
    let file = fixture.sibling("series.patch");
    write_patch_file(&git, &dir, &range("other"), &file, &cancel)
        .await
        .unwrap();
    let files = vec![file];
    fixture.git(&["checkout", "--quiet", "other"]);
    let (outcome, _) = apply_mailbox(&git, &dir, &files, &cancel).await.unwrap();
    assert_eq!(outcome, AmOutcome::Committed);
    assert_eq!(
        fixture.git(&["log", "-1", "--format=%s"]),
        "Change six, add g"
    );

    // The same lines changed differently: the first mail conflicts and git am waits.
    fixture.git(&["checkout", "--quiet", "-B", "other", "main~2"]);
    fs::write(dir.join("f.txt"), LINES.replace("two", "deux")).unwrap();
    fixture.git(&["commit", "--quiet", "-am", "Change two otherwise"]);
    let check = check_patches(&git, &dir, &files, true, &cancel)
        .await
        .unwrap();
    assert_eq!(check.fit, PatchFit::Conflicts);
    let (outcome, _) = apply_mailbox(&git, &dir, &files, &cancel).await.unwrap();
    assert_eq!(outcome, AmOutcome::Stopped);
    assert!(dir.join(".git/rebase-apply").exists());
    fixture.git(&["am", "--abort"]);
}

#[tokio::test]
async fn archives_hold_the_files_of_a_revision() {
    let fixture = series();
    let (git, dir, cancel) = (git(), fixture.path(), CancellationToken::new());
    let output: PathBuf = fixture.sibling("app.tar.gz");
    let command = archive_command(
        &git,
        &dir,
        "main~1",
        ArchiveFormat::TarGz,
        Some("app-1/"),
        &output,
    )
    .unwrap();
    assert!(command.run(&cancel).await.unwrap().success());
    let zip = fixture.sibling("app.zip");
    let command = archive_command(&git, &dir, "main", ArchiveFormat::Zip, None, &zip).unwrap();
    assert!(command.run(&cancel).await.unwrap().success());
    assert!(fs::metadata(&output).unwrap().len() > 0);
    assert!(fs::metadata(&zip).unwrap().len() > 0);
}

#[tokio::test]
async fn patches_to_the_same_lines_apply_one_after_the_other() {
    let fixture = series();
    let (git, dir, cancel) = (git(), fixture.path(), CancellationToken::new());
    // Each commit appends a line: the second patch's context is the first one's line.
    for line in ["eight", "nine"] {
        let mut text = fs::read_to_string(dir.join("f.txt")).unwrap();
        text.push_str(line);
        text.push('\n');
        fs::write(dir.join("f.txt"), text).unwrap();
        fixture.git(&["commit", "--quiet", "-am", line]);
    }
    let folder = fixture.sibling("out");
    fs::create_dir(&folder).unwrap();
    let files = write_patch_folder(&git, &dir, &range("main~2"), &folder, &cancel)
        .await
        .unwrap();
    fixture.git(&["checkout", "--quiet", "-B", "back", "main~2"]);
    let check = check_patches(&git, &dir, &files, false, &cancel)
        .await
        .unwrap();
    assert_eq!(check.fit, PatchFit::Clean);
    let (outcome, _) = apply_patches(&git, &dir, &files, &cancel).await.unwrap();
    assert_eq!(outcome, ApplyOutcome::Applied);
    assert!(
        fs::read_to_string(dir.join("f.txt"))
            .unwrap()
            .ends_with("seven\neight\nnine\n")
    );
}

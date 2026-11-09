//! A conflicted file merged line by line from the index's stages, and the result saved, through
//! the real `git`.
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod support;

use std::fs;

use git_core::cli::Git;
use git_core::operation::{
    ChunkSource, MergeChunk, MergeMode, OperationError, Unmergeable, conflicts, merge, merge_file,
    save_merged,
};
use support::Fixture;
use tokio_util::sync::CancellationToken;

fn git() -> Git {
    Git::locate().expect("tests need git on PATH")
}

fn cancel() -> CancellationToken {
    CancellationToken::new()
}

/// `topic` merged into `main`, both having changed the second line of `file.txt` and `data.bin`.
async fn conflicted(autocrlf: &str) -> Fixture {
    let fixture = Fixture::new();
    for (key, value) in [
        ("user.name", "Ada Lovelace"),
        ("user.email", "ada@example.com"),
        ("core.autocrlf", autocrlf),
    ] {
        fixture.git(&["config", key, value]);
    }
    let dir = fixture.path();
    let write = |main: &str, binary: &[u8]| {
        fs::write(dir.join("file.txt"), format!("one\n{main}\nthree\n")).unwrap();
        fs::write(dir.join("data.bin"), binary).unwrap();
    };
    write("two", b"\0base");
    fixture.git(&["add", "."]);
    fixture.commit("first");
    fixture.git(&["switch", "-q", "-c", "topic"]);
    write("topic", b"\0topic");
    fixture.git(&["commit", "-qam", "topic"]);
    fixture.git(&["switch", "-q", "main"]);
    write("main", b"\0main");
    fixture.git(&["commit", "-qam", "main"]);
    merge(&git(), &dir, "topic", MergeMode::Default, &cancel())
        .await
        .unwrap();
    fixture
}

#[tokio::test]
async fn merges_the_stages_and_saves_the_result() {
    let fixture = conflicted("false").await;
    let dir = fixture.path();
    let repo = gix::open(&dir).unwrap();

    let file = merge_file(&repo, b"file.txt").unwrap().unwrap();
    assert!(!file.crlf);
    assert_eq!(
        file.chunks,
        vec![
            MergeChunk::Resolved {
                source: ChunkSource::Unchanged,
                text: b"one\n".to_vec()
            },
            MergeChunk::Conflict {
                base: b"two\n".to_vec(),
                ours: b"main\n".to_vec(),
                theirs: b"topic\n".to_vec()
            },
            MergeChunk::Resolved {
                source: ChunkSource::Unchanged,
                text: b"three\n".to_vec()
            },
        ]
    );
    assert_eq!(
        merge_file(&repo, b"data.bin").unwrap(),
        Err(Unmergeable::Binary)
    );

    save_merged(
        &git(),
        &dir,
        b"file.txt",
        b"one\nmain and topic\nthree\n",
        &cancel(),
    )
    .await
    .unwrap();
    let left = conflicts(&git(), &dir, &cancel()).await.unwrap();
    assert_eq!(
        left.iter().map(|c| c.path.to_string()).collect::<Vec<_>>(),
        ["data.bin"]
    );
    assert_eq!(
        fs::read_to_string(dir.join("file.txt")).unwrap(),
        "one\nmain and topic\nthree\n"
    );
    assert_eq!(
        fixture.git(&["show", ":file.txt"]),
        "one\nmain and topic\nthree" // the fixture trims git's output
    );
    let repo = gix::open(&dir).unwrap();
    assert_eq!(
        merge_file(&repo, b"file.txt").unwrap(),
        Err(Unmergeable::NoConflict)
    );

    // Saving again is refused: the conflict is gone.
    let again = save_merged(&git(), &dir, b"file.txt", b"x\n", &cancel()).await;
    assert!(matches!(again, Err(OperationError::NotApplicable(_))));
}

#[tokio::test]
async fn the_working_tree_file_gets_the_checkout_line_endings() {
    let fixture = conflicted("true").await;
    let dir = fixture.path();
    save_merged(&git(), &dir, b"file.txt", b"one\nboth\nthree\n", &cancel())
        .await
        .unwrap();
    // Stored with LF; written as a checkout would write it (CRLF with core.autocrlf=true).
    assert_eq!(fixture.git(&["show", ":file.txt"]), "one\nboth\nthree");
    assert_eq!(
        fs::read(dir.join("file.txt")).unwrap(),
        b"one\r\nboth\r\nthree\r\n"
    );
}

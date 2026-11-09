use super::{ChunkSource, MergeChunk, merge_chunks};

fn resolved(source: ChunkSource, text: &str) -> MergeChunk {
    MergeChunk::Resolved {
        source,
        text: text.as_bytes().to_vec(),
    }
}

fn conflict(base: &str, ours: &str, theirs: &str) -> MergeChunk {
    MergeChunk::Conflict {
        base: base.as_bytes().to_vec(),
        ours: ours.as_bytes().to_vec(),
        theirs: theirs.as_bytes().to_vec(),
    }
}

fn merge(base: &str, ours: &str, theirs: &str) -> Vec<MergeChunk> {
    merge_chunks(base.as_bytes(), ours.as_bytes(), theirs.as_bytes())
}

#[test]
fn takes_changes_only_one_side_made() {
    let chunks = merge("a\nb\nc\nd\ne\n", "A\nb\nc\nd\ne\n", "a\nb\nc\nd\nE\n");
    assert_eq!(
        chunks,
        vec![
            resolved(ChunkSource::Ours, "A\n"),
            resolved(ChunkSource::Unchanged, "b\nc\nd\n"),
            resolved(ChunkSource::Theirs, "E\n"),
        ]
    );
}

#[test]
fn takes_the_same_change_once() {
    let chunks = merge("a\nb\nc\n", "a\nB\nc\n", "a\nB\nc\n");
    assert_eq!(
        chunks,
        vec![
            resolved(ChunkSource::Unchanged, "a\n"),
            resolved(ChunkSource::Both, "B\n"),
            resolved(ChunkSource::Unchanged, "c\n"),
        ]
    );
}

#[test]
fn different_changes_of_the_same_lines_conflict() {
    let chunks = merge("a\nb\nc\n", "a\nours\nc\n", "a\ntheirs\nc\n");
    assert_eq!(
        chunks,
        vec![
            resolved(ChunkSource::Unchanged, "a\n"),
            conflict("b\n", "ours\n", "theirs\n"),
            resolved(ChunkSource::Unchanged, "c\n"),
        ]
    );
}

#[test]
fn changes_that_touch_conflict_as_in_git() {
    // Ours changes line 2, theirs line 3: adjacent changes are a conflict in git too.
    let chunks = merge("1\n2\n3\n4\n", "1\nX\n3\n4\n", "1\n2\nY\n4\n");
    assert_eq!(
        chunks,
        vec![
            resolved(ChunkSource::Unchanged, "1\n"),
            conflict("2\n3\n", "X\n3\n", "2\nY\n"),
            resolved(ChunkSource::Unchanged, "4\n"),
        ]
    );
}

#[test]
fn narrows_a_conflict_to_the_lines_the_sides_do_not_share() {
    let chunks = merge("a\nb\n", "same\nours\nend\n", "same\ntheirs\nend\n");
    assert_eq!(
        chunks,
        vec![
            resolved(ChunkSource::Both, "same\n"),
            conflict("a\nb\n", "ours\n", "theirs\n"),
            resolved(ChunkSource::Both, "end\n"),
        ]
    );
}

#[test]
fn splits_files_both_sides_added_where_they_agree() {
    let chunks = merge("", "x\n1\n2\n3\ny\n", "z\n1\n2\n3\nw\n");
    assert_eq!(
        chunks,
        vec![
            conflict("", "x\n", "z\n"),
            resolved(ChunkSource::Both, "1\n2\n3\n"),
            conflict("", "y\n", "w\n"),
        ]
    );
}

#[test]
fn keeps_line_endings_and_a_last_line_without_newline() {
    let chunks = merge("a\r\nb", "a\r\nours", "a\r\ntheirs");
    assert_eq!(
        chunks,
        vec![
            resolved(ChunkSource::Unchanged, "a\r\n"),
            conflict("b", "ours", "theirs"),
        ]
    );
}

#[test]
fn a_deletion_against_a_change_conflicts() {
    let chunks = merge("a\nb\nc\n", "a\nc\n", "a\nB\nc\n");
    assert_eq!(
        chunks,
        vec![
            resolved(ChunkSource::Unchanged, "a\n"),
            conflict("b\n", "", "B\n"),
            resolved(ChunkSource::Unchanged, "c\n"),
        ]
    );
}

#[test]
fn several_regions_keep_their_offsets() {
    // Ours inserts two lines at the top, so its later lines are shifted.
    let base = "1\n2\n3\n4\n5\n6\n7\n";
    let ours = "new\nnew\n1\n2\n3\n4\n5\nours\n7\n";
    let theirs = "1\n2\n3\n4\n5\ntheirs\n7\n";
    let chunks = merge(base, ours, theirs);
    assert_eq!(
        chunks,
        vec![
            resolved(ChunkSource::Ours, "new\nnew\n"),
            resolved(ChunkSource::Unchanged, "1\n2\n3\n4\n5\n"),
            conflict("6\n", "ours\n", "theirs\n"),
            resolved(ChunkSource::Unchanged, "7\n"),
        ]
    );
}

#[test]
fn nothing_changed_is_one_chunk() {
    assert_eq!(
        merge("a\n", "a\n", "a\n"),
        vec![resolved(ChunkSource::Unchanged, "a\n")]
    );
    assert_eq!(merge("", "", ""), vec![]);
}

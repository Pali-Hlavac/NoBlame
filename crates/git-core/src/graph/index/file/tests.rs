#![allow(clippy::unwrap_used)]
use super::*;

fn sample() -> CommitIndex {
    let mut index = CommitIndex::from_parents(&[30, 20, 10], &[&[1], &[2], &[]]);
    index.ids = vec![
        ObjectId::from_hex(b"cccccccccccccccccccccccccccccccccccccccc").unwrap(),
        ObjectId::from_hex(b"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa").unwrap(),
        ObjectId::from_hex(b"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb").unwrap(),
    ];
    index
}

fn bytes(index: &CommitIndex) -> Vec<u8> {
    let mut out = Vec::new();
    index.write_to(&mut out).unwrap();
    out
}

#[test]
fn round_trips() {
    let index = sample();
    let read = CommitIndex::read_from(&bytes(&index)).unwrap();
    assert_eq!(read.ids, index.ids);
    assert_eq!(read.times, index.times);
    assert_eq!(read.parents(0), [1]);
    assert_eq!(read.lookup(&index.ids[2]), Some(2));
}

#[test]
fn rejects_damage() {
    let good = bytes(&sample());
    assert!(matches!(
        CommitIndex::read_from(&good[..good.len() - 1]),
        Err(IndexFileError::Damaged(_))
    ));
    let mut foreign = good.clone();
    foreign[0] = b'X';
    assert!(matches!(
        CommitIndex::read_from(&foreign),
        Err(IndexFileError::Format)
    ));
    // A parent index past the end.
    let mut out_of_range = good.clone();
    let parents_at = HEADER_LEN + 3 * SHA1_LEN + 3 * 8 + 4 * 4;
    out_of_range[parents_at] = 9;
    assert!(matches!(
        CommitIndex::read_from(&out_of_range),
        Err(IndexFileError::Damaged(_))
    ));
}

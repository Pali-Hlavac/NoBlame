//! Text helpers for file diffs: splitting a blob into lines, git's binary test, and how lines
//! and hunk headers are shown.

use gix::bstr::ByteSlice;

/// Longer lines are cut for display: minified files have megabyte-long lines.
pub const MAX_LINE_BYTES: usize = 4096;
/// Git's test for binary contents looks for a NUL byte in this many leading bytes.
const BINARY_PROBE_BYTES: usize = 8000;

/// One side of the diff: the blob and where its lines start.
#[derive(Debug, Default)]
pub(super) struct Side {
    pub data: Vec<u8>,
    /// Start of every line, then the end of the data.
    pub starts: Vec<usize>,
}

impl Side {
    pub fn new(data: Vec<u8>) -> Self {
        let mut starts = vec![0];
        starts.extend(data.find_iter(b"\n").map(|newline| newline + 1));
        if starts.last() != Some(&data.len()) {
            starts.push(data.len());
        }
        Self { data, starts }
    }

    pub fn line_count(&self) -> u32 {
        to_u32(self.starts.len().saturating_sub(1))
    }

    /// The last line has no newline.
    pub fn open(&self) -> bool {
        self.data.last().is_some_and(|&byte| byte != b'\n')
    }

    /// Line `index` without its line ending.
    pub fn line(&self, index: u32) -> &[u8] {
        let index = index as usize;
        let (Some(&start), Some(&end)) = (self.starts.get(index), self.starts.get(index + 1))
        else {
            return &[];
        };
        let line = &self.data[start..end];
        let line = line.strip_suffix(b"\n").unwrap_or(line);
        line.strip_suffix(b"\r").unwrap_or(line)
    }
}

/// `start,len` as git prints it: 1-based, `,len` left out for one line, and the line before
/// the change (`n,0`) for an empty range.
pub(super) fn hunk_range(start: u32, len: u32) -> String {
    match len {
        0 => format!("{start},0"),
        1 => format!("{}", start + 1),
        _ => format!("{},{len}", start + 1),
    }
}

/// The text of a line for display: lossy UTF-8, cut at [`MAX_LINE_BYTES`] on a character
/// boundary.
pub(super) fn display_text(bytes: &[u8]) -> (String, bool) {
    if bytes.len() <= MAX_LINE_BYTES {
        return (bytes.to_str_lossy().into_owned(), false);
    }
    let mut cut = MAX_LINE_BYTES;
    // Step back over UTF-8 continuation bytes (10xxxxxx) so no character is split.
    while cut > 0 && bytes[cut] & 0b1100_0000 == 0b1000_0000 {
        cut -= 1;
    }
    (bytes[..cut].to_str_lossy().into_owned(), true)
}

pub(super) fn is_binary(data: &[u8]) -> bool {
    data[..data.len().min(BINARY_PROBE_BYTES)].contains(&0)
}

/// Line counts fit: blobs are at most [`MAX_DIFF_BLOB_BYTES`](super::MAX_DIFF_BLOB_BYTES).
pub(super) fn to_u32(value: usize) -> u32 {
    u32::try_from(value).unwrap_or(u32::MAX)
}

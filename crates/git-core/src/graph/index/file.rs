//! The on-disk form of a [`CommitIndex`] (ADR 0010). All numbers are little-endian:
//!
//! ```text
//! header (20 bytes): magic "NBCI", version u32, hash kind u8 (1 = SHA-1), 3 reserved bytes,
//!                    commit count u32, parent count u32
//! ids:          count × 20 bytes
//! times:        count × i64
//! parent_start: (count + 1) × u32
//! parents:      parent count × u32
//! by_id:        count × u32 (commit indices sorted by id)
//! ```
//!
//! Reading checks every length and bound, and that `by_id` is strictly sorted, so a damaged or
//! foreign file is rejected instead of producing a wrong graph.

use std::io::{self, Write};
use std::sync::OnceLock;

use gix::ObjectId;

use super::{CommitIndex, to_u32};

const MAGIC: &[u8; 4] = b"NBCI";
/// Bump when the layout above changes; older files are then rebuilt.
const VERSION: u32 = 1;
const HASH_SHA1: u8 = 1;
const SHA1_LEN: usize = 20;
const HEADER_LEN: usize = 20;

/// Why a cache file was not used.
#[derive(Debug, thiserror::Error)]
pub enum IndexFileError {
    /// Not a cache file, another version, or another hash kind.
    #[error("not a NoBlame commit index (version {VERSION}, SHA-1)")]
    Format,
    /// Lengths or indices do not add up.
    #[error("the commit index file is damaged: {0}")]
    Damaged(&'static str),
    /// Only SHA-1 repositories are cached so far.
    #[error("only SHA-1 repositories can be cached")]
    UnsupportedHash,
}

impl CommitIndex {
    /// Writes the index in the format above (sorting ids first if not done yet).
    pub fn write_to(&self, out: &mut impl Write) -> Result<(), IndexFileError> {
        if self.ids.iter().any(|id| id.kind() != gix::hash::Kind::Sha1) {
            return Err(IndexFileError::UnsupportedHash);
        }
        if let Some(first) = self.ids.first() {
            self.lookup(first); // builds `by_id`
        }
        let by_id = self.by_id.get().map_or(&[][..], Vec::as_slice);
        let write = |out: &mut dyn Write| -> io::Result<()> {
            out.write_all(MAGIC)?;
            out.write_all(&VERSION.to_le_bytes())?;
            out.write_all(&[HASH_SHA1, 0, 0, 0])?;
            out.write_all(&to_u32(self.ids.len()).to_le_bytes())?;
            out.write_all(&to_u32(self.parents.len()).to_le_bytes())?;
            for id in &self.ids {
                out.write_all(id.as_bytes())?;
            }
            for time in &self.times {
                out.write_all(&time.to_le_bytes())?;
            }
            for value in self.parent_start.iter().chain(&self.parents).chain(by_id) {
                out.write_all(&value.to_le_bytes())?;
            }
            Ok(())
        };
        write(out).map_err(|_| IndexFileError::Damaged("write failed"))
    }

    /// Reads and validates an index written by [`write_to`](Self::write_to).
    pub fn read_from(bytes: &[u8]) -> Result<Self, IndexFileError> {
        let mut reader = Reader { bytes, at: 0 };
        if reader.take(4)? != MAGIC || reader.u32()? != VERSION || reader.take(4)?[0] != HASH_SHA1 {
            return Err(IndexFileError::Format);
        }
        let count = reader.u32()? as usize;
        let parent_count = reader.u32()? as usize;
        let expected = HEADER_LEN
            + count * SHA1_LEN
            + count * 8
            + (count + 1) * 4
            + parent_count * 4
            + count * 4;
        if bytes.len() != expected {
            return Err(IndexFileError::Damaged("unexpected length"));
        }
        let ids = (0..count)
            .map(|_| reader.take(SHA1_LEN).map(ObjectId::from_bytes_or_panic))
            .collect::<Result<Vec<_>, _>>()?;
        let times = (0..count)
            .map(|_| reader.take(8).map(|b| i64::from_le_bytes(array(b))))
            .collect::<Result<Vec<_>, _>>()?;
        let parent_start = reader.u32s(count + 1)?;
        let parents = reader.u32s(parent_count)?;
        let by_id = reader.u32s(count)?;

        let starts_ok = parent_start.first() == Some(&0)
            && parent_start.last().map(|&last| last as usize) == Some(parent_count)
            && parent_start.windows(2).all(|pair| pair[0] <= pair[1]);
        if !starts_ok {
            return Err(IndexFileError::Damaged("parent ranges"));
        }
        if parents
            .iter()
            .chain(&by_id)
            .any(|&idx| idx as usize >= count)
        {
            return Err(IndexFileError::Damaged("index out of range"));
        }
        let sorted = by_id
            .windows(2)
            .all(|pair| ids[pair[0] as usize] < ids[pair[1] as usize]);
        if !sorted {
            return Err(IndexFileError::Damaged("id order"));
        }
        Ok(Self {
            ids,
            times,
            parent_start,
            parents,
            missing_parents: 0,
            by_id: OnceLock::from(by_id),
        })
    }
}

struct Reader<'a> {
    bytes: &'a [u8],
    at: usize,
}

impl<'a> Reader<'a> {
    fn take(&mut self, len: usize) -> Result<&'a [u8], IndexFileError> {
        let slice = self
            .bytes
            .get(self.at..self.at + len)
            .ok_or(IndexFileError::Damaged("truncated"))?;
        self.at += len;
        Ok(slice)
    }

    fn u32(&mut self) -> Result<u32, IndexFileError> {
        self.take(4).map(|bytes| u32::from_le_bytes(array(bytes)))
    }

    fn u32s(&mut self, count: usize) -> Result<Vec<u32>, IndexFileError> {
        let bytes = self.take(count * 4)?;
        Ok(bytes
            .chunks_exact(4)
            .map(|chunk| u32::from_le_bytes(array(chunk)))
            .collect())
    }
}

/// Copies a slice of known length into an array (lengths are checked by the caller).
fn array<const N: usize>(bytes: &[u8]) -> [u8; N] {
    let mut out = [0; N];
    out.copy_from_slice(&bytes[..N]);
    out
}

#[cfg(test)]
mod tests;

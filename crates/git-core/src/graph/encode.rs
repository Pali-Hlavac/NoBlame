//! Binary encoding of a block of graph rows for the UI (`docs/architecture/ipc.md`).
//!
//! All numbers are little-endian.
//!
//! ```text
//! header (12 bytes): version u8, reserved u8, reserved u16, first_row u32, row_count u32
//! per row:           lane u16, color u16, flags u8, reserved u8, edge_count u16,
//!                    edge_count × (from u16, to u16, color u16)
//! ```
//!
//! Colours are lane colour ids truncated to 16 bits; the UI maps them onto its palette.

use super::RowGeometry;

/// Version written into every block; bump it when the layout above changes.
pub const BLOCK_FORMAT_VERSION: u8 = 1;
/// Row flag: the commit has more than one parent.
pub const FLAG_MERGE: u8 = 1;
/// Row flag: HEAD points at this commit.
pub const FLAG_HEAD: u8 = 1 << 1;

const HEADER_BYTES: usize = 12;
const ROW_BYTES: usize = 8;
const EDGE_BYTES: usize = 6;

/// Encodes `rows` starting at `first_row`; `flags(offset)` gives each row's flags.
pub fn encode_block(first_row: u32, rows: &[RowGeometry], flags: impl Fn(u32) -> u8) -> Vec<u8> {
    let edges: usize = rows.iter().map(|row| row.edges.len()).sum();
    let mut out = Vec::with_capacity(HEADER_BYTES + rows.len() * ROW_BYTES + edges * EDGE_BYTES);
    out.extend_from_slice(&[BLOCK_FORMAT_VERSION, 0, 0, 0]);
    out.extend_from_slice(&first_row.to_le_bytes());
    out.extend_from_slice(&u32::try_from(rows.len()).unwrap_or(u32::MAX).to_le_bytes());
    for (offset, row) in rows.iter().enumerate() {
        out.extend_from_slice(&row.lane.to_le_bytes());
        out.extend_from_slice(&color16(row.color).to_le_bytes());
        out.push(flags(u32::try_from(offset).unwrap_or(u32::MAX)));
        out.push(0);
        let count = u16::try_from(row.edges.len()).unwrap_or(u16::MAX);
        out.extend_from_slice(&count.to_le_bytes());
        for edge in row.edges.iter().take(usize::from(count)) {
            out.extend_from_slice(&edge.from.to_le_bytes());
            out.extend_from_slice(&edge.to.to_le_bytes());
            out.extend_from_slice(&color16(edge.color).to_le_bytes());
        }
    }
    out
}

/// Keeps the low 16 bits; the UI only needs enough distinct ids to cycle its palette.
fn color16(color: u32) -> u16 {
    u16::try_from(color & u32::from(u16::MAX)).unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::graph::Edge;

    #[test]
    fn encodes_header_rows_and_edges() {
        let rows = vec![
            RowGeometry {
                lane: 0,
                color: 7,
                edges: vec![],
            },
            RowGeometry {
                lane: 1,
                color: 0x1_0002,
                edges: vec![Edge {
                    from: 0,
                    to: 1,
                    color: 7,
                }],
            },
        ];
        let bytes = encode_block(
            512,
            &rows,
            |offset| if offset == 1 { FLAG_MERGE } else { 0 },
        );
        assert_eq!(bytes.len(), HEADER_BYTES + 2 * ROW_BYTES + EDGE_BYTES);
        assert_eq!(bytes[0], BLOCK_FORMAT_VERSION);
        assert_eq!(&bytes[4..8], &512_u32.to_le_bytes());
        assert_eq!(&bytes[8..12], &2_u32.to_le_bytes());
        let second = &bytes[HEADER_BYTES + ROW_BYTES..];
        assert_eq!(&second[0..2], &1_u16.to_le_bytes());
        assert_eq!(
            &second[2..4],
            &2_u16.to_le_bytes(),
            "colour truncated to 16 bits"
        );
        assert_eq!(second[4], FLAG_MERGE);
        assert_eq!(&second[6..8], &1_u16.to_le_bytes());
        assert_eq!(&second[8..14], &[0, 0, 1, 0, 7, 0]);
    }
}

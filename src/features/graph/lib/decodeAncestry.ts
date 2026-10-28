/**
 * Decodes the highlight overlay of one block (format in `docs/architecture/ipc.md`): which rows
 * belong to the selected commit's history and which lines lead into it.
 */
import { ANCESTRY_FORMAT_VERSION } from "./constants";
import { BlockFormatError } from "./decode";

const HEADER_BYTES = 16;

/** Overlay of one block; indexes match the {@link GraphBlock} of the same block. */
export interface AncestryBlock {
  firstRow: number;
  count: number;
  /** 1 when the row's commit is in the history. */
  rows: Uint8Array;
  /** 1 when the edge (in the block's edge order) is lit. */
  edges: Uint8Array;
}

export function decodeAncestryBlock(buffer: ArrayBuffer): AncestryBlock {
  if (buffer.byteLength < HEADER_BYTES) {
    throw new BlockFormatError("Highlight block is truncated.");
  }
  const view = new DataView(buffer);
  const version = view.getUint8(0);
  if (version !== ANCESTRY_FORMAT_VERSION) {
    throw new BlockFormatError(`Unsupported highlight block version ${version}.`);
  }
  const firstRow = view.getUint32(4, true);
  const count = view.getUint32(8, true);
  const edgeCount = view.getUint32(12, true);
  if (buffer.byteLength < HEADER_BYTES + count + edgeCount) {
    throw new BlockFormatError("Highlight block is truncated.");
  }
  return {
    firstRow,
    count,
    rows: new Uint8Array(buffer, HEADER_BYTES, count),
    edges: new Uint8Array(buffer, HEADER_BYTES + count, edgeCount),
  };
}

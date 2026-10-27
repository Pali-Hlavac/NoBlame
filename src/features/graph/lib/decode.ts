/**
 * Decodes one binary graph block (format in `docs/architecture/ipc.md`) into typed arrays.
 * Rows stay outside React state; the canvas reads them directly.
 */
import { BLOCK_FORMAT_VERSION } from "./constants";

const HEADER_BYTES = 12;
const ROW_BYTES = 8;
const EDGE_BYTES = 6;

/** Rows of one block. Row `i` of the block is graph row `firstRow + i`. */
export interface GraphBlock {
  firstRow: number;
  count: number;
  lanes: Uint16Array;
  colors: Uint16Array;
  flags: Uint8Array;
  /** Edges of row `i` are `edgeStart[i] .. edgeStart[i + 1]` (in edge units). */
  edgeStart: Uint32Array;
  /** Three values per edge: from lane, to lane, colour id. */
  edges: Uint16Array;
}

export class BlockFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockFormatError";
  }
}

export function decodeBlock(buffer: ArrayBuffer): GraphBlock {
  const view = new DataView(buffer);
  if (buffer.byteLength < HEADER_BYTES) throw new BlockFormatError("Graph block is truncated.");
  const version = view.getUint8(0);
  if (version !== BLOCK_FORMAT_VERSION) {
    throw new BlockFormatError(`Unsupported graph block version ${version}.`);
  }
  const firstRow = view.getUint32(4, true);
  const count = view.getUint32(8, true);
  const lanes = new Uint16Array(count);
  const colors = new Uint16Array(count);
  const flags = new Uint8Array(count);
  const edgeStart = new Uint32Array(count + 1);
  const edgeValues: number[] = [];

  let offset = HEADER_BYTES;
  for (let row = 0; row < count; row += 1) {
    if (offset + ROW_BYTES > buffer.byteLength)
      throw new BlockFormatError("Graph row is truncated.");
    lanes[row] = view.getUint16(offset, true);
    colors[row] = view.getUint16(offset + 2, true);
    flags[row] = view.getUint8(offset + 4);
    const edgeCount = view.getUint16(offset + 6, true);
    offset += ROW_BYTES;
    edgeStart[row] = edgeValues.length / 3;
    if (offset + edgeCount * EDGE_BYTES > buffer.byteLength) {
      throw new BlockFormatError("Graph edges are truncated.");
    }
    for (let edge = 0; edge < edgeCount; edge += 1) {
      edgeValues.push(
        view.getUint16(offset, true),
        view.getUint16(offset + 2, true),
        view.getUint16(offset + 4, true),
      );
      offset += EDGE_BYTES;
    }
  }
  edgeStart[count] = edgeValues.length / 3;
  return { firstRow, count, lanes, colors, flags, edgeStart, edges: Uint16Array.from(edgeValues) };
}

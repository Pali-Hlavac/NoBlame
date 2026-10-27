import { BlockFormatError, decodeBlock } from "./decode";

/** Builds a block the way `crates/git-core/src/graph/encode.rs` does. */
function encode(
  firstRow: number,
  rows: { lane: number; color: number; flags: number; edges: number[][] }[],
) {
  const bytes: number[] = [1, 0, 0, 0];
  const u16 = (value: number) => bytes.push(value & 0xff, value >> 8);
  const u32 = (value: number) =>
    bytes.push(value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, value >>> 24);
  u32(firstRow);
  u32(rows.length);
  for (const row of rows) {
    u16(row.lane);
    u16(row.color);
    bytes.push(row.flags, 0);
    u16(row.edges.length);
    for (const edge of row.edges) edge.forEach(u16);
  }
  return new Uint8Array(bytes).buffer;
}

describe("decodeBlock", () => {
  it("reads rows and their edges", () => {
    const block = decodeBlock(
      encode(256, [
        { lane: 0, color: 3, flags: 2, edges: [] },
        {
          lane: 1,
          color: 300,
          flags: 1,
          edges: [
            [0, 0, 3],
            [0, 1, 300],
          ],
        },
      ]),
    );
    expect(block.firstRow).toBe(256);
    expect(block.count).toBe(2);
    expect(Array.from(block.lanes)).toEqual([0, 1]);
    expect(Array.from(block.colors)).toEqual([3, 300]);
    expect(Array.from(block.flags)).toEqual([2, 1]);
    expect(Array.from(block.edgeStart)).toEqual([0, 0, 2]);
    expect(Array.from(block.edges)).toEqual([0, 0, 3, 0, 1, 300]);
  });

  it("rejects unknown versions and truncated data", () => {
    const valid = encode(0, [{ lane: 0, color: 0, flags: 0, edges: [[0, 0, 0]] }]);
    const wrongVersion = new Uint8Array(valid.slice(0));
    wrongVersion[0] = 9;
    expect(() => decodeBlock(wrongVersion.buffer)).toThrow(BlockFormatError);
    expect(() => decodeBlock(valid.slice(0, valid.byteLength - 2))).toThrow(BlockFormatError);
    expect(() => decodeBlock(new ArrayBuffer(4))).toThrow(BlockFormatError);
  });
});

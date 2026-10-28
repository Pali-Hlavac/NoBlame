import { decodeAncestryBlock } from "./decodeAncestry";

function overlay(version: number, rows: number[], edges: number[]): ArrayBuffer {
  const bytes = new Uint8Array(16 + rows.length + edges.length);
  const view = new DataView(bytes.buffer);
  view.setUint8(0, version);
  view.setUint32(4, 256, true);
  view.setUint32(8, rows.length, true);
  view.setUint32(12, edges.length, true);
  bytes.set(rows, 16);
  bytes.set(edges, 16 + rows.length);
  return bytes.buffer;
}

describe("decodeAncestryBlock", () => {
  it("reads rows and lit edges", () => {
    const block = decodeAncestryBlock(overlay(1, [1, 0, 1], [0, 1]));
    expect(block.firstRow).toBe(256);
    expect([...block.rows]).toEqual([1, 0, 1]);
    expect([...block.edges]).toEqual([0, 1]);
  });

  it("rejects other versions and truncated data", () => {
    expect(() => decodeAncestryBlock(overlay(2, [1], []))).toThrow(/version 2/);
    expect(() => decodeAncestryBlock(overlay(1, [1], [1]).slice(0, 17))).toThrow(/truncated/);
  });
});

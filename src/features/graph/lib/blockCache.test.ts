import { BlockCache } from "./blockCache";

/** An encoded block with one empty row, tagged with `firstRow` so tests can tell blocks apart. */
function emptyBlock(firstRow: number): ArrayBuffer {
  const bytes = new Uint8Array(12 + 8);
  const view = new DataView(bytes.buffer);
  view.setUint8(0, 1);
  view.setUint32(4, firstRow, true);
  view.setUint32(8, 1, true);
  return bytes.buffer;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("BlockCache", () => {
  it("loads each block once and reports arrivals", async () => {
    const fetchBlock = vi.fn((block: number) => Promise.resolve(emptyBlock(block * 256)));
    const onLoad = vi.fn();
    const cache = new BlockCache(fetchBlock, 4, onLoad, vi.fn());

    cache.request(2);
    cache.request(2);
    await flush();
    cache.request(2);

    expect(fetchBlock).toHaveBeenCalledTimes(1);
    expect(onLoad).toHaveBeenCalledWith(2);
    expect(cache.get(2)?.firstRow).toBe(512);
  });

  it("evicts the least recently used block", async () => {
    const cache = new BlockCache(
      (block) => Promise.resolve(emptyBlock(block)),
      2,
      vi.fn(),
      vi.fn(),
    );
    cache.request(1);
    cache.request(2);
    await flush();
    cache.get(1);
    cache.request(3);
    await flush();
    expect(cache.get(1)).toBeDefined();
    expect(cache.get(2)).toBeUndefined();
    expect(cache.get(3)).toBeDefined();
  });

  it("reports failures once and does not retry until cleared", async () => {
    const fetchBlock = vi.fn(() => Promise.reject(new Error("closed")));
    const onError = vi.fn();
    const cache = new BlockCache(fetchBlock, 2, vi.fn(), onError);
    cache.request(0);
    await flush();
    cache.request(0);
    await flush();
    expect(fetchBlock).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
    cache.clear();
    cache.request(0);
    expect(fetchBlock).toHaveBeenCalledTimes(2);
  });
});

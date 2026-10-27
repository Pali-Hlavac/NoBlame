/**
 * Least-recently-used cache of decoded graph blocks for one repository. Lives outside React
 * state; `onLoad` tells the view to redraw when a requested block arrives.
 */
import { decodeBlock, type GraphBlock } from "./decode";

export type FetchBlock = (block: number) => Promise<ArrayBuffer>;

export class BlockCache {
  private readonly blocks = new Map<number, GraphBlock>();
  private readonly pending = new Map<number, Promise<void>>();
  private readonly failed = new Set<number>();

  constructor(
    private readonly fetchBlock: FetchBlock,
    private readonly capacity: number,
    private readonly onLoad: (block: number) => void,
    private readonly onError: (error: unknown) => void,
  ) {}

  /** The block if it is loaded (marks it as recently used). */
  get(block: number): GraphBlock | undefined {
    const value = this.blocks.get(block);
    if (value) {
      this.blocks.delete(block);
      this.blocks.set(block, value);
    }
    return value;
  }

  /** Starts loading `block` unless it is loaded, loading, or failed before. */
  request(block: number): void {
    if (this.blocks.has(block) || this.pending.has(block) || this.failed.has(block)) return;
    const loading = this.fetchBlock(block)
      .then((buffer) => {
        this.blocks.set(block, decodeBlock(buffer));
        this.evict();
        this.onLoad(block);
      })
      .catch((error: unknown) => {
        this.failed.add(block);
        this.onError(error);
      })
      .finally(() => {
        this.pending.delete(block);
      });
    this.pending.set(block, loading);
  }

  /** Forgets everything (after a reload of the graph). */
  clear(): void {
    this.blocks.clear();
    this.failed.clear();
  }

  private evict(): void {
    while (this.blocks.size > this.capacity) {
      const oldest = this.blocks.keys().next();
      if (oldest.done) return;
      this.blocks.delete(oldest.value);
    }
  }
}

# 0008: Binary graph blocks fetched on demand

- Status: Accepted
- Date: 2026-10-27
- Milestone: M2

## Context and problem

The commit graph must show the first screen of a 1M-commit history in under a second, scroll at
60 fps and stay within about 200 bytes per commit. Each row needs its node lane and colour and
every line that passes through it. Busy histories have dozens of active lanes, so storing those
lines for every row costs hundreds of megabytes for a million commits. Sending them to the webview
as JSON would be slower still.

The roadmap planned "streaming binary row batches over Tauri channels". The question is how the
geometry gets from Rust to the canvas: pushed in full, or pulled per visible region.

## Decision drivers

- Memory bounded in both processes, independent of history length.
- Random access: dragging the scroll bar to the middle of a million rows must not wait for
  everything before it.
- No JSON for bulk data (CLAUDE.md, ADR 0003).
- Simple cancellation and lifetime: closing a tab must not leave a stream running.
- Typed bindings stay usable (tauri-specta).

## Considered options

1. Push every row over a Tauri `Channel` in binary batches after the graph is built.
2. Pull blocks of 256 rows on demand with a request/response command returning raw bytes; Rust
   keeps lane-state checkpoints and re-lays out a block when asked.
3. Pull rows as JSON pages.

## Decision outcome

Chosen option: **2, on-demand binary blocks**, because it bounds memory on both sides and gives
random access at negligible cost.

- `git-core::graph::Layout` lays out all rows once and keeps a checkpoint of the lane state every
  `BLOCK_ROWS` = 256 rows (about 5 MB for 1M commits). `Graph::encode_block` replays one block
  from its checkpoint (0.1–0.2 ms) and encodes it (`graph/encode.rs`, format in
  [ipc.md](../architecture/ipc.md#binary-graph-blocks), version byte 1).
- `get_graph_block(id, block)` returns a `GraphBytes` value. Tauri sends it as a raw
  `InvokeResponseBody`, so the webview gets an `ArrayBuffer` with no JSON step. A manual
  `specta::Type` impl types it as `unknown`, and `fetchGraphBlock` narrows it to `ArrayBuffer`.
- The frontend keeps the 96 most recently used blocks in typed arrays (`BlockCache`), requests the
  visible blocks plus one block of margin on each side, and redraws when a block arrives.
- Commit text is a separate JSON command, `get_commit_rows`, in pages of 100 rows.

### Consequences

Good:

- Rust memory for geometry is constant per block; the webview holds at most 96 blocks.
- Jumping anywhere in the history costs one block request.
- No long-lived stream to cancel; a closed session just stops answering.
- The format is versioned and covered by tests on both sides (`encode.rs`, `decode.test.ts`).

Bad:

- One IPC round trip per block (build 0.1–0.2 ms plus transport). On very fast scrolling a row
  can be blank for a frame until its block arrives.
- The layout algorithm must stay deterministic so that a replay equals the full pass (tested in
  `graph/tests.rs`).
- Raw command results bypass tauri-specta's typing (`unknown`); the client narrows at runtime.

## Pros and cons of the options

### Option 1: push everything over a Channel

- Good: no request latency once streamed.
- Bad: the webview must hold geometry for every row (or Rust must buffer it), both unbounded;
  a jump to the end waits for the whole stream; a stream must be cancelled when the tab closes.

### Option 3: JSON pages

- Good: simplest, fully typed.
- Bad: several times larger and slower to parse than the binary format, for the hottest path.

## Links

- [ADR 0009](0009-canvas-graph-and-lane-layout.md) (canvas and lanes), ADR 0010 (cache, planned)
- [commit-graph.md](../architecture/commit-graph.md), [ipc.md](../architecture/ipc.md)
- [performance.md](../development/performance.md)

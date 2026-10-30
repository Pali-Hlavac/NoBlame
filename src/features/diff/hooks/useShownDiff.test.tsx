import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

import type { DiffLineDto, FileDiffDto } from "@/shared/ipc/bindings";

import { unifiedPageQuery, type DiffRequest } from "../api/diff";
import { ROW_HEIGHT_PX } from "../lib/constants";
import { useShownDiff } from "./useShownDiff";

const ipc = vi.hoisted(() => ({ getFileDiff: vi.fn(), findDiffRow: vi.fn() }));

vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc }));

function summary(rows: number): FileDiffDto {
  return {
    content: "text",
    rows,
    splitRows: rows,
    additions: 1,
    deletions: 1,
    hunks: 1,
    oldLines: rows,
    newLines: rows,
    oldSize: "0",
    newSize: "0",
  };
}

function request(context: number, path = "a.txt"): DiffRequest {
  return {
    repoId: 1,
    oldId: "old",
    newId: "new",
    path,
    options: { whitespace: "show", context, syntax: false },
  };
}

/** Row `index` shows line `index + 1` of both versions. */
const line = (index: number): DiffLineDto => ({
  kind: "context",
  oldLine: index + 1,
  newLine: index + 1,
  text: "",
  truncated: false,
  highlights: [],
  syntax: [],
});

/** A promise executor that never resolves. */
function neverSettles(): void {
  // Stays loading.
}

describe("useShownDiff", () => {
  it("keeps the old diff while the new one loads, then opens it at the middle line", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    ipc.getFileDiff.mockImplementation((_id: number, dto: { options: { context: number } }) =>
      Promise.resolve({ status: "ok", data: summary(dto.options.context === 3 ? 100 : 1_000) }),
    );
    ipc.findDiffRow.mockResolvedValue({ status: "ok", data: 500 });
    // A view 200 px high scrolled to 400 px: row 25 (line 26) is in the middle, 100 px down.
    const viewport = { current: { scrollTop: 400, clientHeight: 200 } as HTMLDivElement };
    client.setQueryData(
      unifiedPageQuery(request(3), 0).queryKey,
      Array.from({ length: 100 }, (_, i) => line(i)),
    );
    const { result, rerender } = renderHook(
      ({ shownRequest }) => useShownDiff(shownRequest, "unified", viewport, true),
      { wrapper, initialProps: { shownRequest: request(3) } },
    );
    await waitFor(() => {
      expect(result.current.shown?.diff.rows).toBe(100);
    });
    expect(result.current.shown?.scrollTop).toBe(0);
    expect(result.current.pending).toBe(false);

    rerender({ shownRequest: request(10) });
    expect(result.current.pending).toBe(true);
    expect(result.current.shown?.request.options.context).toBe(3);

    await waitFor(() => {
      expect(result.current.pending).toBe(false);
    });
    expect(ipc.findDiffRow).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ path: "a.txt" }),
      "unified",
      "new",
      26,
    );
    expect(result.current.shown?.diff.rows).toBe(1_000);
    expect(result.current.shown?.scrollTop).toBe(500 * ROW_HEIGHT_PX - 100);
  });

  it("does not show another file's diff while a file loads", async () => {
    const client = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    ipc.getFileDiff.mockResolvedValue({ status: "ok", data: summary(10) });
    const viewport = { current: null };
    const { result, rerender } = renderHook(
      ({ shownRequest }) => useShownDiff(shownRequest, "unified", viewport, true),
      { wrapper, initialProps: { shownRequest: request(3) } },
    );
    await waitFor(() => {
      expect(result.current.shown).not.toBeNull();
    });
    ipc.getFileDiff.mockReturnValue(new Promise(neverSettles));
    rerender({ shownRequest: request(3, "b.txt") });
    expect(result.current.shown).toBeNull();
    expect(result.current.pending).toBe(true);
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { LfsStateDto } from "@/shared/ipc/bindings";
import { TooltipProvider } from "@/shared/ui/tooltip";

import { lfsSummary } from "../lib/lfs";
import { Lfs } from "./LfsModule";

const ipc = vi.hoisted(() => ({
  getLfs: vi.fn(),
  listLfsLocks: vi.fn(),
  lockLfsFile: vi.fn(),
  unlockLfsFile: vi.fn(),
  pullLfs: vi.fn(),
}));
const jobs = vi.hoisted(() => ({ startJob: vi.fn(), afterJob: vi.fn() }));

vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc }));
vi.mock("@/features/jobs", () => jobs);
vi.mock("@/features/repositories", () => ({ WithActiveRepository: () => null }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

function ok<T>(data: T) {
  return Promise.resolve({ status: "ok" as const, data });
}

const STATE: LfsStateDto = {
  version: "git-lfs/3.8.0",
  files: [
    { path: "art/logo.psd", size: "3.0 MB", oid: "a".repeat(64), hasContent: true },
    { path: "video/intro.mp4", size: "120 MB", oid: "b".repeat(64), hasContent: false },
  ],
  total: 2,
};

function renderLfs() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <Lfs repoId={1} path="C:\code\app" />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe("Git LFS module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists LFS files, marks pointers and downloads their contents", async () => {
    const user = userEvent.setup();
    ipc.getLfs.mockReturnValue(ok(STATE));
    ipc.pullLfs.mockReturnValue(ok(3));
    renderLfs();
    expect(await screen.findByText("2 files in Git LFS · 1 only as a pointer")).toBeVisible();
    const list = screen.getByRole("list", { name: "LFS files" });
    expect(within(list).getAllByText("pointer only")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Download contents" }));
    expect(ipc.pullLfs).toHaveBeenCalledWith("C:\\code\\app");
    expect(jobs.startJob).toHaveBeenCalledWith(expect.any(Promise), "lfsPull");
  });

  it("says when git-lfs is not installed", async () => {
    ipc.getLfs.mockReturnValue(ok({ version: null, files: [], total: 0 }));
    renderLfs();
    expect(await screen.findByText("Git LFS is not installed")).toBeVisible();
    expect(screen.queryByRole("region", { name: "Locks" })).toBeNull();
  });

  it("asks before forcing someone else's lock open", async () => {
    const user = userEvent.setup();
    ipc.getLfs.mockReturnValue(ok(STATE));
    ipc.listLfsLocks.mockReturnValue(
      ok({
        locks: [
          { id: "7", path: "art/logo.psd", owner: "Grace", lockedAt: "2026-11-10T10:00:00Z" },
        ],
        warning: null,
        hint: null,
      }),
    );
    ipc.unlockLfsFile.mockImplementation((_id: number, _lock: string, force: boolean) =>
      force
        ? ok("Unlocked")
        : Promise.resolve({
            status: "error" as const,
            error: { code: "gitFailed", message: "Cannot unlock: owned by Grace", hint: null },
          }),
    );
    renderLfs();
    await user.click(await screen.findByRole("button", { name: "Show locks" }));
    expect(await screen.findByText(/^Grace/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Unlock" }));
    const confirm = await screen.findByRole("dialog");
    expect(confirm).toHaveTextContent("it is Grace's lock");
    await user.click(within(confirm).getByRole("button", { name: "Force the unlock" }));
    await waitFor(() => {
      expect(ipc.unlockLfsFile).toHaveBeenLastCalledWith(1, "7", true);
    });
  });

  it("explains an empty list when git-lfs could not reach a server", async () => {
    const user = userEvent.setup();
    ipc.getLfs.mockReturnValue(ok(STATE));
    ipc.listLfsLocks.mockReturnValue(
      ok({ locks: [], warning: "hint: The remote resolves to a file:// URL", hint: "No server." }),
    );
    renderLfs();
    await user.click(await screen.findByRole("button", { name: "Show locks" }));
    expect(await screen.findByText("No server.")).toBeVisible();
    expect(screen.queryByText("Nobody holds a lock.")).toBeNull();
  });

  it("words the summary", () => {
    expect(lfsSummary({ ...STATE, files: STATE.files.slice(0, 1), total: 1 })).toBe(
      "1 file in Git LFS",
    );
  });
});

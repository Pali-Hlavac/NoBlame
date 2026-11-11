import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";

import type { PatchCheckDto } from "@/shared/ipc/bindings";

import { archiveBaseName, countText, patchFileName, slug } from "../lib/patches";
import {
  closePatchDialog,
  openApplyPatches,
  openArchive,
  openCreatePatches,
} from "../store/dialog";
import { PatchDialogs } from "./PatchDialogs";

const ipc = vi.hoisted(() => ({
  countPatches: vi.fn(),
  savePatches: vi.fn(),
  checkPatches: vi.fn(),
  applyPatches: vi.fn(),
  saveArchive: vi.fn(),
}));
const dialog = vi.hoisted(() => ({ open: vi.fn() }));

vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc }));
vi.mock("@tauri-apps/plugin-dialog", () => dialog);
vi.mock("@/features/jobs", () => ({ trackJob: vi.fn((started: Promise<number>) => started) }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  }),
}));

function ok<T>(data: T) {
  return Promise.resolve({ status: "ok" as const, data });
}

function renderDialogs() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <PatchDialogs />
    </QueryClientProvider>,
  );
}

const TIP = { revision: "a".repeat(40), label: "aaaaaaaa Fix the parser", parentCount: 1 };

const SERIES: PatchCheckDto = {
  files: [
    {
      path: "C:\\out\\0001-Fix.patch",
      name: "0001-Fix.patch",
      contents: {
        kind: "mailbox",
        mails: [{ subject: "Fix the parser", author: "Ada", hasDiff: true }],
      },
    },
    {
      path: "C:\\out\\0002-Test.patch",
      name: "0002-Test.patch",
      contents: {
        kind: "mailbox",
        mails: [{ subject: "Test it", author: "Ada", hasDiff: true }],
      },
    },
  ],
  fit: { kind: "clean" },
  paths: [{ path: "src/parse.rs", added: 3, removed: 1 }],
  totalPaths: 1,
};

describe("patch words", () => {
  it("name files and count commits", () => {
    expect(slug("Žluťoučký kůň: fix!")).toBe("Zlutoucky-kun-fix");
    expect(patchFileName("aaaaaaaa", "Fix the parser", null)).toBe("aaaaaaaa-Fix-the-parser.patch");
    expect(patchFileName("aaaaaaaa", "x", "origin/main")).toBe("origin-main..aaaaaaaa.patch");
    expect(countText({ commits: 3, merges: 1 })).toBe(
      "3 commits (1 merge left out: a patch cannot hold a merge)",
    );
    expect(archiveBaseName("NoBlame", "v1.0")).toBe("NoBlame-v1.0");
  });
});

describe("patch dialogs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    closePatchDialog();
  });

  it("saves the patches of the commits after a base, one file per commit", async () => {
    const user = userEvent.setup();
    ipc.countPatches.mockImplementation((_id: number, commits: { base: string | null }) =>
      ok(commits.base ? { commits: 2, merges: 1 } : { commits: 1, merges: 0 }),
    );
    ipc.savePatches.mockReturnValue(ok({ path: "C:\\out", commits: 2, files: 2 }));
    renderDialogs();
    openCreatePatches(1, TIP);
    const form = await screen.findByRole("dialog");
    expect(await within(form).findByText("1 commit")).toBeVisible();
    await user.click(within(form).getByLabelText(/The commits after/));
    await user.type(within(form).getByLabelText("After this branch, tag or commit"), "main");
    expect(await within(form).findByText(/2 commits \(1 merge left out/)).toBeVisible();
    await user.click(within(form).getByLabelText("One file per commit, in a folder"));
    await user.click(within(form).getByRole("button", { name: "Save…" }));
    expect(ipc.savePatches).toHaveBeenCalledWith(1, {
      commits: { tip: TIP.revision, base: "main" },
      output: "folder",
      fileName: "main..aaaaaaaa.patch",
    });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Saved 2 patches", { description: "C:\\out" });
    });
  });

  it("checks chosen mails, then makes commits from them", async () => {
    const user = userEvent.setup();
    dialog.open.mockResolvedValue(["C:\\out\\0002-Test.patch", "C:\\out\\0001-Fix.patch"]);
    ipc.checkPatches.mockReturnValue(ok(SERIES));
    ipc.applyPatches.mockReturnValue(ok("committed"));
    renderDialogs();
    openApplyPatches(1);
    const form = await screen.findByRole("dialog");
    await user.click(within(form).getByRole("button", { name: "Choose patch files…" }));
    expect(await within(form).findByText("They apply cleanly.")).toBeVisible();
    expect(within(form).getByText("Fix the parser · Ada")).toBeVisible();
    expect(within(form).getByText("src/parse.rs")).toBeVisible();
    expect(within(form).getByLabelText("Make commits from them")).toBeChecked();
    await user.click(within(form).getByRole("button", { name: "Apply" }));
    expect(ipc.applyPatches).toHaveBeenCalledWith(
      1,
      ["C:\\out\\0002-Test.patch", "C:\\out\\0001-Fix.patch"],
      "commits",
    );
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Made 2 commits from the patches", {
        description: undefined,
      });
    });
  });

  it("offers only changing the files for a plain diff that does not apply", async () => {
    const user = userEvent.setup();
    dialog.open.mockResolvedValue(["C:\\fix.diff"]);
    ipc.checkPatches.mockReturnValue(
      ok({
        ...SERIES,
        files: [{ path: "C:\\fix.diff", name: "fix.diff", contents: { kind: "diff" } }],
        fit: { kind: "fails", message: "error: src/parse.rs: patch does not apply" },
      }),
    );
    renderDialogs();
    openApplyPatches(1);
    const form = await screen.findByRole("dialog");
    await user.click(within(form).getByRole("button", { name: "Choose patch files…" }));
    expect(await within(form).findByText("They do not apply here.")).toBeVisible();
    await waitFor(() => {
      expect(within(form).getByLabelText("Only change the files")).toBeChecked();
    });
    expect(within(form).getByLabelText("Make commits from them")).toBeDisabled();
    expect(within(form).getByRole("button", { name: "Apply" })).toBeDisabled();
  });

  it("saves an archive in a folder named after the repository and the tag", async () => {
    const user = userEvent.setup();
    ipc.saveArchive.mockReturnValue(ok(7));
    renderDialogs();
    openArchive(1, "C:\\code\\NoBlame", { revision: "v1.0", label: "v1.0" }, "v1.0");
    const form = await screen.findByRole("dialog");
    await user.click(within(form).getByLabelText(/Tar, gzip-compressed/));
    await user.click(within(form).getByRole("button", { name: "Save…" }));
    expect(ipc.saveArchive).toHaveBeenCalledWith({
      path: "C:\\code\\NoBlame",
      revision: "v1.0",
      label: "v1.0",
      format: "tarGz",
      folder: "NoBlame-v1.0",
      fileName: "NoBlame-v1.0.tar.gz",
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });
});

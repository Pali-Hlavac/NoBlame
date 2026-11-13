import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";

import { useSelectionStore } from "@/features/selection";
import type { FileDisplay, WorkingFileDto, WorkingTreeStatusDto } from "@/shared/ipc/bindings";

import { StagingLists } from "./StagingLists";

const ipc = vi.hoisted(() => ({ getStatus: vi.fn(), getSettings: vi.fn() }));
vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc }));

function file(path: string): WorkingFileDto {
  return {
    path,
    previousPath: null,
    status: "modified",
    oldId: null,
    newId: null,
    worktree: true,
    submodule: false,
    submoduleChanges: null,
  };
}

/** Git's order: byte order puts `src/a-b` before `src/a/`. */
const STATUS: WorkingTreeStatusDto = {
  summary: {
    staged: 0,
    unstaged: 3,
    untracked: 0,
    conflicted: 0,
    changes: { added: 0, changed: 3, deleted: 0 },
  },
  staged: [],
  unstaged: [file("src/a-b/z.ts"), file("src/a/y.ts"), file("README.md")],
  operation: null,
  stagedOutside: 0,
};

async function renderedRows(fileDisplay: FileDisplay): Promise<string[]> {
  ipc.getSettings.mockResolvedValue({ status: "ok", data: { commit: { fileDisplay } } });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <StagingLists repoId={1} repoPath="/repo" showDiff={false} />
    </QueryClientProvider>,
  );
  const list = await screen.findByRole("listbox", { name: "Changes" });
  if (fileDisplay === "pathFirst") await within(list).findByText("src/a/");
  return within(list)
    .getAllByRole("option")
    .map((row) => row.textContent);
}

describe("StagingLists order", () => {
  beforeEach(() => {
    useSelectionStore.setState({ selections: {}, files: {} });
    ipc.getStatus.mockResolvedValue({ status: "ok", data: STATUS });
  });

  it("keeps git's order with the name first", async () => {
    expect(await renderedRows("nameFirst")).toEqual(["Mz.tssrc/a-b", "My.tssrc/a", "MREADME.md"]);
  });

  it("puts the folder first and sorts by the whole path", async () => {
    expect(await renderedRows("pathFirst")).toEqual(["MREADME.md", "Msrc/a/y.ts", "Msrc/a-b/z.ts"]);
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { RefEntry, RefKindDto } from "@/shared/ipc/bindings";

import { BRANCH_SPECS } from "./branchTasks";
import { RefPickDialog } from "./RefPickDialog";
import { useRefPickStore } from "./refPick";
import type { TaskTarget } from "./specs";

const ipc = vi.hoisted(() => ({ listRefs: vi.fn(), getUpstreams: vi.fn(), getStatus: vi.fn() }));
vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc }));
const actions = vi.hoisted(() => ({
  checkoutBranch: vi.fn(),
  checkoutRemote: vi.fn(),
  checkoutCommit: vi.fn(),
  merge: vi.fn(),
  rebase: vi.fn(),
}));
const stashes = vi.hoisted(() => ({ openStashChanges: vi.fn() }));
vi.mock("@/features/branches", () => ({ useRefActions: () => actions }));
vi.mock("@/features/stashes", () => stashes);

const TARGET = "b".repeat(40);
function ref(kind: RefKindDto, name: string, isHead = false): RefEntry {
  return { label: { kind, name, isHead }, target: TARGET, row: 0, commitTime: 0 };
}
const REFS = [
  ref("branch", "main", true),
  ref("branch", "feature/login"),
  ref("remote", "origin/main"),
  ref("remote", "origin/topic"),
  ref("tag", "v1.0"),
];

function renderDialog(operation: string | null = null) {
  ipc.listRefs.mockResolvedValue({ status: "ok", data: REFS });
  ipc.getUpstreams.mockResolvedValue({
    status: "ok",
    data: [{ branch: "main", upstream: "refs/remotes/origin/main", gone: false }],
  });
  ipc.getStatus.mockResolvedValue({
    status: "ok",
    data: {
      summary: { staged: 0, unstaged: 0, untracked: 0, conflicted: 0 },
      staged: [],
      unstaged: [],
      operation: operation ? { kind: operation, detail: null, step: null, steps: null } : null,
      stagedOutside: 0,
    },
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RefPickDialog repoId={3} />
    </QueryClientProvider>,
  );
}

const target = { summary: { id: 3 } } as TaskTarget;

describe("the Switch, Merge and Rebase windows' question", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRefPickStore.setState({ open: null });
  });

  it("switches to a local branch at once, chosen by typing", async () => {
    const user = userEvent.setup();
    renderDialog();
    BRANCH_SPECS.switch?.start?.(target);
    const dialog = await screen.findByRole("dialog", { name: "Switch to" });
    await within(dialog).findByRole("option", { name: "feature/login" });
    expect(within(dialog).queryByRole("option", { name: "main" })).toBeNull();
    await user.type(within(dialog).getByRole("combobox"), "login{Enter}");
    expect(actions.checkoutBranch).toHaveBeenCalledWith("feature/login");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("switches to a remote branch through its own dialog, and to a typed commit", async () => {
    const user = userEvent.setup();
    renderDialog();
    BRANCH_SPECS.switch?.start?.(target);
    await user.click(await screen.findByRole("option", { name: "origin/topic" }));
    expect(actions.checkoutRemote).toHaveBeenCalledWith({
      namespace: "remote",
      name: "origin/topic",
      target: TARGET,
    });
    BRANCH_SPECS.switch?.start?.(target);
    await user.type(await screen.findByRole("combobox"), "HEAD~2");
    await user.click(screen.getByRole("option", { name: "Use “HEAD~2”" }));
    expect(actions.checkoutCommit).toHaveBeenCalledWith({ revision: "HEAD~2", label: "HEAD~2" });
  });

  it("merges the upstream by default, then asks how", async () => {
    const user = userEvent.setup();
    renderDialog();
    BRANCH_SPECS.merge?.start?.(target);
    const dialog = await screen.findByRole("dialog", { name: "Merge into main" });
    const upstream = await within(dialog).findByRole("option", { name: /origin\/main/ });
    expect(upstream).toHaveAttribute("aria-selected", "true");
    expect(upstream).toHaveTextContent("upstream");
    await user.keyboard("{Enter}");
    expect(actions.merge).toHaveBeenCalledWith({
      revision: "refs/remotes/origin/main",
      label: "origin/main",
    });
  });

  it("rebases onto a tag", async () => {
    const user = userEvent.setup();
    renderDialog();
    BRANCH_SPECS.rebase?.start?.(target);
    await screen.findByRole("dialog", { name: "Rebase main onto" });
    await user.click(await screen.findByRole("option", { name: "v1.0" }));
    expect(actions.rebase).toHaveBeenCalledWith({ revision: "refs/tags/v1.0", label: "v1.0" });
  });

  it("says what stands in the way while a merge is in progress", async () => {
    const user = userEvent.setup();
    renderDialog("merge");
    BRANCH_SPECS.merge?.start?.(target);
    expect(await screen.findByText(/A merge is in progress/)).toBeVisible();
    await user.click(await screen.findByRole("option", { name: "v1.0" }));
    expect(actions.merge).not.toHaveBeenCalled();
  });

  it("the Stash window opens Stash changes", () => {
    BRANCH_SPECS.stash?.start?.(target);
    expect(stashes.openStashChanges).toHaveBeenCalledWith(3);
    expect(BRANCH_SPECS.stash?.modules).toEqual(["stashes"]);
  });
});

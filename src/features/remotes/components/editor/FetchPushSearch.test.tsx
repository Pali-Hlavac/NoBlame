import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { RemoteSettingsDto } from "@/shared/ipc/bindings";

import { RemoteEditor } from "./RemoteEditor";

const ipc = vi.hoisted(() => ({
  getRemoteSettings: vi.fn(),
  previewRemoteChanges: vi.fn(),
  applyRemoteChanges: vi.fn(),
}));
const jobs = vi.hoisted(() => ({ startFetch: vi.fn(() => "job"), startJob: vi.fn() }));

vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc }));
vi.mock("@/features/jobs", () => jobs);
vi.mock("@/features/repositories", () => ({ useRepositoryPath: () => "C:\\code\\app" }));
vi.mock("@/features/git-env", () => ({ useGitInfo: () => ({ data: { version: "2.56.0" } }) }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), info: vi.fn() }),
}));

function ok<T>(data: T) {
  return Promise.resolve({ status: "ok", data });
}

const SETTINGS: RemoteSettingsDto = {
  name: "origin",
  head: "main",
  branches: ["main"],
  entries: [
    {
      key: "remote.origin.url",
      value: "https://h/a.git",
      scope: "local",
      file: null,
      secret: false,
    },
    {
      key: "remote.origin.fetch",
      value: "+refs/heads/*:refs/remotes/origin/*",
      scope: "local",
      file: null,
      secret: false,
    },
    { key: "fetch.prune", value: "true", scope: "global", file: "~/.gitconfig", secret: false },
  ],
};

function renderEditor() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RemoteEditor
        repoId={1}
        name="origin"
        otherRemotes={[]}
        onDirtyChange={vi.fn()}
        onRenamed={vi.fn()}
        onRemove={vi.fn()}
      />
    </QueryClientProvider>,
  );
}

describe("Fetch and Push tabs, and the search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ipc.getRemoteSettings.mockReturnValue(ok(SETTINGS));
    ipc.previewRemoteChanges.mockReturnValue(ok(["git config …"]));
  });

  it("fetches chosen branches only, as one refspec each", async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(await screen.findByRole("tab", { name: "Fetch" }));
    expect(screen.getByRole("radio", { name: "Every branch" })).toBeChecked();
    // Not set here: the user's fetch.prune applies.
    expect(screen.getByRole("option", { name: "As fetch.prune says (now: yes)" })).toBeTruthy();
    await user.click(screen.getByRole("radio", { name: /Only these branches/ }));
    expect(screen.getByLabelText("Branch to fetch")).toHaveValue("main");
    await user.click(screen.getByRole("button", { name: "Add a branch" }));
    await user.type(screen.getByLabelText("Branch to fetch 2"), "release/*");
    await user.click(screen.getByRole("button", { name: "Review and save…" }));
    expect(ipc.previewRemoteChanges).toHaveBeenCalledWith(1, {
      name: "origin",
      newName: null,
      head: null,
      keys: [
        {
          key: "remote.origin.fetch",
          before: ["+refs/heads/*:refs/remotes/origin/*"],
          after: [
            "+refs/heads/main:refs/remotes/origin/main",
            "+refs/heads/release/*:refs/remotes/origin/release/*",
          ],
        },
      ],
    });

    await user.click(await screen.findByRole("button", { name: "Back" }));
    await user.click(screen.getByRole("button", { name: "Fetch and remove deleted branches now" }));
    expect(jobs.startFetch).toHaveBeenCalledWith({
      path: "C:\\code\\app",
      target: { type: "remote", name: "origin" },
      prune: true,
    });
  });

  it("warns about removing tags and asks before mirroring", async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(await screen.findByRole("tab", { name: "Fetch" }));
    await user.selectOptions(
      screen.getByLabelText("Remove tags that are not on the server"),
      "true",
    );
    expect(screen.getByText(/Tags you made here and did not push are deleted/)).toBeVisible();

    await user.click(screen.getByRole("tab", { name: "Push" }));
    await user.click(screen.getByLabelText("Mirror this repository"));
    const confirm = await screen.findByRole("dialog", { name: /mirror push/ });
    await user.click(within(confirm).getByRole("button", { name: "Mirror on every push" }));
    expect(screen.getByLabelText("Mirror this repository")).toBeChecked();
    expect(screen.getByText("2 changes not saved yet.")).toBeVisible();
  });

  it("finds settings across tabs and steps through them", async () => {
    const user = userEvent.setup();
    renderEditor();
    const search = await screen.findByRole("searchbox", { name: "Search the remote's settings" });
    await user.keyboard("{Control>}f{/Control}");
    expect(search).toHaveFocus();
    await user.type(search, "tagopt");
    // The only match is on the Fetch tab, which opens.
    expect(screen.getByRole("tab", { name: /Fetch/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /General/ })).toHaveClass("opacity-50");
    await user.keyboard("{Enter}");
    expect(screen.getByText("1 of 1")).toBeVisible();
    await user.keyboard("{Escape}");
    expect(search).toHaveValue("");
  });
});

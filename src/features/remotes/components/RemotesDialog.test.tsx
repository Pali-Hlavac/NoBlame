import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { RemoteDto, RemoteSettingsDto } from "@/shared/ipc/bindings";

import { openRemotes } from "../store/dialog";
import { RemoteDialogs } from "./RemoteDialogs";

const ipc = vi.hoisted(() => ({
  listRemoteDetails: vi.fn(),
  addRemote: vi.fn(),
  removeRemote: vi.fn(),
  getRemoteSettings: vi.fn(),
  previewRemoteChanges: vi.fn(),
  applyRemoteChanges: vi.fn(),
  setGitConfig: vi.fn(),
}));
const jobs = vi.hoisted(() => ({ startFetch: vi.fn(), startJob: vi.fn() }));

vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc }));
vi.mock("@/features/jobs", () => jobs);
vi.mock("@/features/git-env", () => ({ useGitInfo: () => ({ data: { version: "2.56.0" } }) }));
vi.mock("@/features/repositories", () => ({
  useRepositoryPath: () => "C:\\code\\app",
  repositoryName: () => "app",
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), info: vi.fn(), error: vi.fn() }),
}));

function ok<T>(data: T) {
  return Promise.resolve({ status: "ok", data });
}

const ORIGIN: RemoteDto = {
  name: "origin",
  shownUrl: "https://ada:***@example.com/app.git",
  shownPushUrl: null,
  extraUrls: 0,
  branches: 2,
  trackedBy: ["main"],
};

function settings(name: string): RemoteSettingsDto {
  return {
    name,
    head: "main",
    branches: ["main", "topic"],
    localBranches: ["main"],
    usesLfs: false,
    sshKey: null,
    entries: [
      {
        key: `remote.${name}.url`,
        value: "https://ada:***@example.com/app.git",
        scope: "local",
        file: ".git/config",
        secret: true,
      },
    ],
  };
}

function renderDialogs() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RemoteDialogs />
    </QueryClientProvider>,
  );
  act(() => {
    openRemotes(1);
  });
}

describe("Remotes dialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ipc.listRemoteDetails.mockReturnValue(ok([ORIGIN]));
    ipc.setGitConfig.mockReturnValue(ok(null));
    ipc.getRemoteSettings.mockImplementation((_id: number, name: string) => ok(settings(name)));
  });

  it("lists remotes without their passwords and adds one, fetching it", async () => {
    const user = userEvent.setup();
    ipc.addRemote.mockReturnValue(ok(""));
    renderDialogs();
    const list = await screen.findByRole("list", { name: "Remotes" });
    expect(within(list).getByText("https://ada:***@example.com/app.git")).toBeVisible();
    expect(within(list).getByText("2 remote branches · tracked by main")).toBeVisible();
    // The first remote opens in the editor.
    expect(await screen.findByRole("tab", { name: "General" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "Add remote…" }));
    const form = screen.getByRole("form", { name: "Add a remote" });
    // "origin" is taken, so the name starts empty.
    const name = within(form).getByLabelText("Name");
    expect(name).toHaveValue("");
    await user.type(name, "origin");
    expect(screen.getByText("There is already a remote named origin.")).toBeVisible();
    await user.clear(name);
    await user.type(name, "upstream");
    await user.type(within(form).getByLabelText("URL"), "git@example.com:team/app.git");
    await user.click(within(form).getByRole("button", { name: "Add remote" }));
    expect(ipc.addRemote).toHaveBeenCalledWith(1, {
      name: "upstream",
      url: "git@example.com:team/app.git",
    });
    await waitFor(() => {
      expect(jobs.startFetch).toHaveBeenCalledWith({
        path: "C:\\code\\app",
        target: { type: "remote", name: "upstream" },
        prune: false,
      });
    });
  });

  it("adds the original of a fork and keeps pushing to the fork", async () => {
    const user = userEvent.setup();
    ipc.addRemote.mockReturnValue(ok(""));
    ipc.setGitConfig.mockReturnValue(ok(null));
    renderDialogs();
    await user.click(await screen.findByRole("button", { name: "Add remote…" }));
    await user.click(screen.getByRole("button", { name: "Add the original as upstream" }));
    const form = screen.getByRole("form", { name: "Add a remote" });
    expect(within(form).getByLabelText("Name")).toHaveValue("upstream");
    expect(within(form).getByRole("checkbox", { name: /Keep pushing to origin/ })).toBeChecked();
    await user.type(within(form).getByLabelText("URL"), "https://example.com/original/app.git");
    await user.click(within(form).getByRole("button", { name: "Add remote" }));
    await waitFor(() => {
      expect(ipc.setGitConfig).toHaveBeenCalledWith(1, "local", "remote.pushDefault", "origin");
    });
  });

  it("names what removing a remote takes before removing it", async () => {
    const user = userEvent.setup();
    ipc.removeRemote.mockReturnValue(ok(""));
    renderDialogs();
    await user.click(await screen.findByRole("button", { name: "Remove origin…" }));
    const confirm = await screen.findByRole("dialog", { name: "Remove the remote origin?" });
    expect(
      within(confirm).getByText(/Its 2 remote branches go from this repository/),
    ).toBeVisible();
    expect(within(confirm).getByText(/main will no longer track it/)).toBeVisible();
    await user.click(within(confirm).getByRole("button", { name: "Remove remote" }));
    expect(ipc.removeRemote).toHaveBeenCalledWith(1, "origin");
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Remove the remote origin?" })).toBeNull();
    });
  });

  it("clears the search on Esc before closing", async () => {
    const user = userEvent.setup();
    renderDialogs();
    const search = await screen.findByRole("searchbox", { name: "Search the remote's settings" });
    await user.type(search, "url");
    await user.keyboard("{Escape}");
    expect(search).toHaveValue("");
    expect(screen.getByRole("dialog", { name: "Remotes of app" })).toBeVisible();
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Remotes of app" })).toBeNull();
    });
  });

  it("asks before dropping unsaved changes", async () => {
    const user = userEvent.setup();
    renderDialogs();
    const url = await screen.findByLabelText("URL");
    await user.type(url, "x");
    expect(screen.getByText("1 change not saved yet.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Add remote…" }));
    const confirm = await screen.findByRole("dialog", { name: "Discard the unsaved changes?" });
    await user.click(within(confirm).getByRole("button", { name: "Discard changes" }));
    expect(await screen.findByRole("form", { name: "Add a remote" })).toBeVisible();
  });
});

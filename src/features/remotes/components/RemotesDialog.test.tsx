import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { RemoteDto } from "@/shared/ipc/bindings";

import { openRemotes } from "../store/dialog";
import { RemoteDialogs } from "./RemoteDialogs";

const ipc = vi.hoisted(() => ({
  listRemoteDetails: vi.fn(),
  addRemote: vi.fn(),
  editRemote: vi.fn(),
  removeRemote: vi.fn(),
}));
const jobs = vi.hoisted(() => ({ startFetch: vi.fn(), startJob: vi.fn() }));

vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc }));
vi.mock("@/features/jobs", () => jobs);
vi.mock("@/features/repositories", () => ({
  useRepositoryPath: () => "C:\\code\\app",
  repositoryName: () => "app",
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn() }) }));

function ok<T>(data: T) {
  return Promise.resolve({ status: "ok", data });
}

const ORIGIN: RemoteDto = {
  name: "origin",
  url: "https://ada:secret@example.com/app.git",
  pushUrl: null,
  shownUrl: "https://ada:***@example.com/app.git",
  shownPushUrl: null,
  extraUrls: 0,
  branches: 2,
  trackedBy: ["main"],
};

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
  });

  it("lists remotes without their passwords and adds one, fetching it", async () => {
    const user = userEvent.setup();
    ipc.addRemote.mockReturnValue(ok(""));
    renderDialogs();
    const item = await screen.findByRole("listitem");
    expect(within(item).getByText("https://ada:***@example.com/app.git")).toBeVisible();
    expect(within(item).getByText("2 remote branches · tracked by main")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Add remote…" }));
    // "origin" is taken, so the name starts empty.
    const name = screen.getByLabelText("Name");
    expect(name).toHaveValue("");
    await user.type(name, "origin");
    expect(screen.getByText("There is already a remote named origin.")).toBeVisible();
    await user.clear(name);
    await user.type(name, "upstream");
    await user.type(screen.getByLabelText("URL"), "git@example.com:team/app.git");
    await user.click(screen.getByRole("button", { name: "Add remote" }));
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
    expect(await screen.findByRole("button", { name: "Add remote…" })).toBeVisible();
  });

  it("renames a remote and gives it a push URL", async () => {
    const user = userEvent.setup();
    ipc.editRemote.mockReturnValue(ok(""));
    renderDialogs();
    await user.click(await screen.findByRole("button", { name: "Edit origin" }));
    // The URL is edited as configured.
    expect(screen.getByLabelText("URL")).toHaveValue(ORIGIN.url);
    const name = screen.getByLabelText("Name");
    await user.clear(name);
    await user.type(name, "github");
    expect(screen.getByText(/moves its remote branches to github/)).toBeVisible();
    await user.type(screen.getByLabelText("Push URL"), "ssh://example.com/app.git");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(ipc.editRemote).toHaveBeenCalledWith(1, {
      name: "origin",
      newName: "github",
      url: ORIGIN.url,
      pushUrl: "ssh://example.com/app.git",
    });
  });

  it("names what removing a remote takes before removing it", async () => {
    const user = userEvent.setup();
    ipc.removeRemote.mockReturnValue(ok(""));
    renderDialogs();
    await user.click(await screen.findByRole("button", { name: "Remove origin" }));
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
});

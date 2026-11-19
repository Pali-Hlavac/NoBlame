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

vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc }));
vi.mock("@/features/git-env", () => ({ useGitInfo: () => ({ data: { version: "2.45.1" } }) }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), info: vi.fn() }),
}));

function ok<T>(data: T) {
  return Promise.resolve({ status: "ok", data });
}

const SETTINGS: RemoteSettingsDto = {
  name: "origin",
  head: "main",
  branches: ["main", "topic"],
  localBranches: ["main"],
  sshKey: null,
  entries: [
    {
      key: "remote.origin.url",
      value: "https://example.com/app.git",
      scope: "local",
      file: ".git/config",
      secret: false,
    },
    {
      key: "remote.origin.fetch",
      value: "+refs/heads/*:refs/remotes/origin/*",
      scope: "local",
      file: ".git/config",
      secret: false,
    },
    {
      key: "remote.origin.prune",
      value: "true",
      scope: "global",
      file: "C:/Users/ada/.gitconfig",
      secret: false,
    },
    {
      key: "url.git@example.com:.insteadof",
      value: "https://example.com/",
      scope: "global",
      file: "C:/Users/ada/.gitconfig",
      secret: false,
    },
  ],
};

const props = {
  repoId: 1,
  name: "origin",
  otherRemotes: ["upstream"],
  onDirtyChange: vi.fn(),
  onRenamed: vi.fn(),
  onRemove: vi.fn(),
};

function renderEditor() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RemoteEditor {...props} />
    </QueryClientProvider>,
  );
}

describe("RemoteEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ipc.getRemoteSettings.mockReturnValue(ok(SETTINGS));
  });

  it("collects a rename and a push URL, shows the commands, then saves them", async () => {
    const user = userEvent.setup();
    const commands = [
      "git config --local --add remote.origin.pushurl ssh://example.com/app.git",
      "git remote rename origin github",
    ];
    ipc.previewRemoteChanges.mockReturnValue(ok(commands));
    ipc.applyRemoteChanges.mockReturnValue(ok(null));
    renderEditor();
    expect(await screen.findByLabelText("URL")).toHaveValue("https://example.com/app.git");
    const name = screen.getByLabelText("Name");
    await user.clear(name);
    await user.type(name, "upstream");
    expect(screen.getByText("There is already a remote named upstream.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Review and save…" })).toBeDisabled();
    await user.clear(name);
    await user.type(name, "github");
    await user.click(screen.getByRole("button", { name: "Add a push URL" }));
    await user.type(screen.getByLabelText("Push URL"), "ssh://example.com/app.git");
    expect(screen.getByText("2 changes not saved yet.")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Review and save…" }));
    const edit = {
      name: "origin",
      newName: "github",
      head: null,
      keys: [{ key: "remote.origin.pushurl", before: [], after: ["ssh://example.com/app.git"] }],
    };
    expect(ipc.previewRemoteChanges).toHaveBeenCalledWith(1, edit);
    const review = await screen.findByRole("dialog", { name: "Save the changes to origin?" });
    expect(within(review).getByText(commands[1] ?? "")).toBeVisible();
    await user.click(within(review).getByRole("button", { name: "Save" }));
    expect(ipc.applyRemoteChanges).toHaveBeenCalledWith(1, edit);
    expect(props.onRenamed).toHaveBeenCalledWith("github");
  });

  it("disables what the git in use does not know", async () => {
    renderEditor();
    const follow = await screen.findByLabelText("When the server's default branch changes");
    expect(follow).toBeDisabled();
    expect(screen.getByText(/Needs git 2.48 or later; NoBlame runs git 2.45/)).toBeVisible();
  });

  it("shows every key with inherited values and the rewrites that apply", async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(await screen.findByRole("tab", { name: "Advanced" }));
    expect(screen.getByLabelText("remote.origin.fetch")).toHaveValue(
      "+refs/heads/*:refs/remotes/origin/*",
    );
    expect(
      screen.getByText(/From your user settings \(C:\/Users\/ada\/.gitconfig\)/),
    ).toBeVisible();
    expect(screen.getByText("applies to origin")).toBeVisible();

    await user.type(screen.getByLabelText("Setting"), "tagOpt");
    await user.type(screen.getByLabelText("Value"), "--no-tags");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByLabelText("remote.origin.tagOpt")).toHaveValue("--no-tags");
    expect(screen.getByText("1 change not saved yet.")).toBeVisible();
  });
});

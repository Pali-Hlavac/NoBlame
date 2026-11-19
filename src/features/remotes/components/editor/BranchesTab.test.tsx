import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { RemoteSettingsDto } from "@/shared/ipc/bindings";

import { RemoteEditor } from "./RemoteEditor";

const ipc = vi.hoisted(() => ({
  getRemoteSettings: vi.fn(),
  previewRemoteChanges: vi.fn(),
  applyRemoteChanges: vi.fn(),
}));

vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc }));
vi.mock("@/features/jobs", () => ({ startFetch: vi.fn(), startJob: vi.fn() }));
vi.mock("@/features/repositories", () => ({ useRepositoryPath: () => "C:\\code\\app" }));
vi.mock("@/features/git-env", () => ({ useGitInfo: () => ({ data: { version: "2.56.0" } }) }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), info: vi.fn() }),
}));

function ok<T>(data: T) {
  return Promise.resolve({ status: "ok", data });
}

const local = (key: string, value: string) => ({
  key,
  value,
  scope: "local" as const,
  file: ".git/config",
  secret: false,
});

const SETTINGS: RemoteSettingsDto = {
  name: "upstream",
  head: "main",
  branches: ["dev", "main"],
  localBranches: ["main", "spike"],
  sshKey: null,
  entries: [
    local("remote.upstream.url", "https://h/original.git"),
    local("branch.main.remote", "upstream"),
    local("branch.main.merge", "refs/heads/main"),
    local("remote.pushdefault", "origin"),
  ],
};

describe("Branches tab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ipc.getRemoteSettings.mockReturnValue(ok(SETTINGS));
    ipc.previewRemoteChanges.mockReturnValue(ok(["git config …"]));
  });

  it("changes upstreams, push remotes and pull modes, and tracks another branch", async () => {
    const user = userEvent.setup();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <RemoteEditor
          repoId={1}
          name="upstream"
          otherRemotes={["origin"]}
          onDirtyChange={vi.fn()}
          onRenamed={vi.fn()}
          onRemove={vi.fn()}
        />
      </QueryClientProvider>,
    );
    await user.click(await screen.findByRole("tab", { name: "Branches" }));
    expect(screen.getByLabelText("Upstream of main")).toHaveValue("main");
    // Pushing follows remote.pushDefault unless the branch says otherwise.
    expect(
      screen.getByRole("option", { name: "As the repository says (origin)" }),
    ).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Upstream of main"), "dev");
    await user.selectOptions(screen.getByLabelText("How main pulls"), "true");
    await user.selectOptions(screen.getByLabelText("Branch to track this remote"), "spike");
    await user.selectOptions(screen.getByLabelText("Its upstream"), "main");
    await user.click(screen.getByRole("button", { name: "Track" }));
    expect(screen.getByLabelText("Upstream of spike")).toHaveValue("main");
    await user.selectOptions(screen.getByLabelText("Pulling joins the commits by"), "true");

    await user.click(screen.getByRole("button", { name: "Review and save…" }));
    expect(ipc.previewRemoteChanges).toHaveBeenCalledWith(1, {
      name: "upstream",
      newName: null,
      head: null,
      keys: [
        { key: "branch.main.merge", before: ["refs/heads/main"], after: ["refs/heads/dev"] },
        { key: "branch.main.rebase", before: [], after: ["true"] },
        { key: "branch.spike.remote", before: [], after: ["upstream"] },
        { key: "branch.spike.merge", before: [], after: ["refs/heads/main"] },
        { key: "pull.rebase", before: [], after: ["true"] },
      ],
    });
  });
});

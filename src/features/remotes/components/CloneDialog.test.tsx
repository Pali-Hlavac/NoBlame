import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { JobDto } from "@/shared/ipc/bindings";

import { openClone } from "../store/dialog";
import { RemoteDialogs } from "./RemoteDialogs";

const jobs = vi.hoisted(() => ({ startClone: vi.fn(), afterJob: vi.fn() }));
const repositories = vi.hoisted(() => ({
  openRepositories: vi.fn(),
  pickFolder: vi.fn(),
  useRecentRepositories: () => ({
    isPending: false,
    data: [{ path: "C:\\code\\older" }],
  }),
}));

vi.mock("@/features/jobs", () => jobs);
vi.mock("@/features/repositories", () => repositories);

function renderClone() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RemoteDialogs />
    </QueryClientProvider>,
  );
  act(() => {
    openClone();
  });
}

describe("Clone dialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clones next to the newest repository with the options chosen, then opens it", async () => {
    const user = userEvent.setup();
    jobs.startClone.mockResolvedValue(4);
    renderClone();
    expect(screen.getByLabelText("Into")).toHaveValue("C:\\code");
    await user.type(screen.getByLabelText("URL"), "https://example.com/team/rocket.git");
    expect(screen.getByLabelText("Folder name")).toHaveValue("rocket");
    expect(screen.getByText("Clones into C:\\code\\rocket")).toBeVisible();
    await user.click(screen.getByLabelText("Only the newest commits:"));
    await user.clear(screen.getByLabelText("Number of commits"));
    await user.type(screen.getByLabelText("Number of commits"), "50");
    await user.selectOptions(screen.getByLabelText("Download"), "blobless");
    await user.click(screen.getByRole("button", { name: "Clone" }));
    expect(jobs.startClone).toHaveBeenCalledWith({
      url: "https://example.com/team/rocket.git",
      folder: "C:\\code\\rocket",
      branch: null,
      depth: 50,
      singleBranch: false,
      filter: "blobless",
      recurseSubmodules: true,
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    // The job ends: a success opens the new repository.
    const [[id, onEnd]] = jobs.afterJob.mock.calls as [[number, (job: Partial<JobDto>) => void]];
    expect(id).toBe(4);
    onEnd({ state: "succeeded", repoPath: "C:\\code\\rocket" });
    expect(repositories.openRepositories).toHaveBeenCalledWith(["C:\\code\\rocket"]);
  });

  it("keeps a name of the user's own and stays open when the clone cannot start", async () => {
    const user = userEvent.setup();
    jobs.startClone.mockRejectedValue(new Error("C:\\code\\mine already exists and is not empty."));
    renderClone();
    await user.type(screen.getByLabelText("URL"), "git@example.com:team/rocket.git");
    const name = screen.getByLabelText("Folder name");
    await user.clear(name);
    await user.type(name, "mine");
    await user.type(screen.getByLabelText("URL"), "2");
    expect(name).toHaveValue("mine");
    await user.click(screen.getByRole("button", { name: "Clone" }));
    expect(await screen.findByText(/already exists and is not empty/)).toBeVisible();
    expect(screen.getByRole("dialog", { name: "Clone repository" })).toBeVisible();
    expect(jobs.afterJob).not.toHaveBeenCalled();
  });
});

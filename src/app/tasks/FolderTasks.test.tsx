import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

import type { JobDto } from "@/shared/ipc/bindings";
import { onActionDone } from "@/shared/lib/actionDone";

import { CloneTask } from "./CloneTask";
import { InitTask } from "./InitTask";

const ipc = vi.hoisted(() => ({
  inspectFolder: vi.fn(),
  initRepository: vi.fn(),
  openInMainWindow: vi.fn(),
  cloneRepository: vi.fn(),
}));
vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc }));
const jobs = vi.hoisted(() => ({
  startClone: vi.fn(),
  afterJob: vi.fn(),
  trackJob: (started: Promise<number>) => started,
}));
vi.mock("@/features/jobs", () => jobs);

function renderWith(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

describe("the Create repository window", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ipc.openInMainWindow.mockResolvedValue({ status: "ok", data: null });
  });

  it("creates the repository in the folder given, then offers to open it", async () => {
    const user = userEvent.setup();
    const done = vi.fn();
    const stop = onActionDone(done);
    ipc.inspectFolder.mockResolvedValue({
      status: "ok",
      data: { kind: "missing", repository: null, isRepository: false },
    });
    ipc.initRepository.mockResolvedValue({ status: "ok", data: null });
    renderWith(<InitTask path="/work/rocket" />);
    expect(await screen.findByText(/will be created/)).toBeVisible();
    expect(screen.getByLabelText("Folder")).toHaveValue("/work/rocket");
    await user.click(screen.getByRole("button", { name: "Create" }));
    expect(ipc.initRepository).toHaveBeenCalledWith("/work/rocket");
    expect(await screen.findByRole("region", { name: "Created a repository" })).toBeVisible();
    expect(done).toHaveBeenCalledWith("init");
    await user.click(screen.getByRole("button", { name: "Open in NoBlame" }));
    expect(ipc.openInMainWindow).toHaveBeenCalledWith("/work/rocket");
    stop();
  });

  it("does not create a repository where one is already, but opens it", async () => {
    const user = userEvent.setup();
    ipc.inspectFolder.mockResolvedValue({
      status: "ok",
      data: { kind: "filled", repository: "/work/app", isRepository: true },
    });
    renderWith(<InitTask path="/work/app" />);
    expect(await screen.findByText("This folder is a repository already.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Open in NoBlame" }));
    expect(ipc.openInMainWindow).toHaveBeenCalledWith("/work/app");
  });
});

describe("the Clone window", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ipc.openInMainWindow.mockResolvedValue({ status: "ok", data: null });
    jobs.startClone.mockResolvedValue(9);
  });

  async function startClone(user: ReturnType<typeof userEvent.setup>) {
    renderWith(<CloneTask path="/code" />);
    expect(screen.getByLabelText("Into")).toHaveValue("/code");
    await user.type(screen.getByLabelText("URL"), "https://example.com/team/rocket.git");
    await user.click(screen.getByRole("button", { name: "Clone" }));
    expect(await screen.findByText(/^Cloning into \/code\/rocket/)).toBeVisible();
    const [[id, onEnd]] = jobs.afterJob.mock.calls as [[number, (job: Partial<JobDto>) => void]];
    expect(id).toBe(9);
    return onEnd;
  }

  it("clones into a new folder in the one given, then opens it in NoBlame", async () => {
    const user = userEvent.setup();
    const onEnd = await startClone(user);
    expect(jobs.startClone).toHaveBeenCalledWith(
      expect.objectContaining({ folder: "/code/rocket" }),
    );
    onEnd({ state: "succeeded", repoPath: "/code/rocket" });
    expect(await screen.findByRole("region", { name: "Cloned" })).toHaveTextContent("/code/rocket");
    // "Open it when done" is on by default.
    expect(ipc.openInMainWindow).toHaveBeenCalledWith("/code/rocket");
  });

  it("says why a clone failed and starts over", async () => {
    const user = userEvent.setup();
    const onEnd = await startClone(user);
    onEnd({ state: "failed", message: "Repository not found." });
    expect(await screen.findByText("The clone failed")).toBeVisible();
    expect(screen.getByText("Repository not found.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByLabelText("URL")).toBeVisible();
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";

import type { JobDto } from "@/shared/ipc/bindings";

import { useJobEvents } from "../hooks/useJobEvents";
import { useJobsPanel } from "../store/panel";
import { JobsIndicator } from "./JobsIndicator";

type Listener = (event: { payload: { job: JobDto } }) => void;

const ipc = vi.hoisted(() => ({
  listJobs: vi.fn(),
  getJobLog: vi.fn(),
  cancelJob: vi.fn(),
  listeners: [] as ((event: { payload: { job: unknown } }) => void)[],
}));

vi.mock("@/shared/ipc/bindings", () => ({
  commands: ipc,
  events: {
    jobUpdated: {
      listen: (listener: Listener) => {
        ipc.listeners.push(listener as (typeof ipc.listeners)[number]);
        return Promise.resolve(() => undefined);
      },
    },
  },
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

function job(overrides: Partial<JobDto> = {}): JobDto {
  return {
    id: 7,
    kind: "fetch",
    title: "Fetch origin",
    repoPath: "C:\\code\\app",
    command: "git fetch --progress origin",
    state: "running",
    progress: { phase: "Receiving objects", percent: 45, detail: "1.2 MiB | 3 MiB/s" },
    message: null,
    logLines: 1,
    startedAt: Date.now() / 1000,
    finishedAt: null,
    ...overrides,
  };
}

function Harness() {
  useJobEvents();
  return <JobsIndicator />;
}

function renderIndicator() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <Harness />
    </QueryClientProvider>,
  );
}

describe("JobsIndicator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ipc.listeners.length = 0;
    useJobsPanel.setState({ open: false, expanded: null });
  });

  it("shows nothing until a job ran", async () => {
    ipc.listJobs.mockResolvedValue([]);
    renderIndicator();
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows the running job's progress, cancels it and shows its log", async () => {
    const user = userEvent.setup();
    ipc.listJobs.mockResolvedValue([job()]);
    ipc.getJobLog.mockResolvedValue(["From https://example.com/app"]);
    ipc.cancelJob.mockResolvedValue(true);
    renderIndicator();
    const button = await screen.findByRole("button", {
      name: /Fetch origin: Receiving objects 45%/,
    });
    await user.click(button);
    expect(screen.getByRole("progressbar", { name: "Fetch origin progress" })).toHaveAttribute(
      "aria-valuenow",
      "45",
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(ipc.cancelJob).toHaveBeenCalledWith(7);
    await user.click(screen.getByRole("button", { name: /Log \(1\)/ }));
    expect(await screen.findByText(/From https:\/\/example.com\/app/)).toBeVisible();
    expect(ipc.getJobLog).toHaveBeenCalledWith(7);
  });

  it("follows job events and announces how a job ended", async () => {
    ipc.listJobs.mockResolvedValue([]);
    renderIndicator();
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      for (const listener of ipc.listeners) listener({ payload: { job: job() } });
    });
    expect(await screen.findByRole("button", { name: /Fetch origin/ })).toBeVisible();
    expect(toast.success).not.toHaveBeenCalled();
    act(() => {
      for (const listener of ipc.listeners) {
        listener({
          payload: {
            job: job({ state: "succeeded", progress: null, message: "2 new", finishedAt: 1 }),
          },
        });
      }
    });
    expect(toast.success).toHaveBeenCalledWith("Fetch origin: 2 new", { description: "app" });
    expect(await screen.findByRole("button", { name: /^Jobs/ })).toBeVisible();
    act(() => {
      for (const listener of ipc.listeners) {
        listener({ payload: { job: job({ id: 8, state: "failed", message: "no remote" }) } });
      }
    });
    expect(toast.error).toHaveBeenCalledWith(
      "Fetch origin failed",
      expect.objectContaining({ description: "app\nno remote" }),
    );
  });
});

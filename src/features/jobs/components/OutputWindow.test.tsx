import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { JobDto } from "@/shared/ipc/bindings";

import { useJobEvents } from "../hooks/useJobEvents";
import { forgetOwnJobs, ownJob } from "../lib/own";
import { closeOutput } from "../store/output";
import { OutputWindow } from "./OutputWindow";

type Listener = (event: { payload: { job: JobDto } }) => void;

const ipc = vi.hoisted(() => ({
  listJobs: vi.fn(),
  getJobOutput: vi.fn(),
  cancelJob: vi.fn(),
  getSettings: vi.fn(),
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
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(() => "toast-1"),
    dismiss: vi.fn(),
  }),
}));

function job(overrides: Partial<JobDto> = {}): JobDto {
  return {
    id: 7,
    kind: "pull",
    title: "Pull main",
    repoPath: "C:\\code\\app",
    command: "git pull --progress --no-edit",
    state: "running",
    progress: { phase: "Receiving objects", percent: 45, detail: "(9/20)" },
    message: null,
    logLines: 1,
    startedAt: 0,
    finishedAt: null,
    ...overrides,
  };
}

/** A job update; `own`: this window started the job. */
function emit(update: JobDto, own = true) {
  if (own) ownJob(update.id);
  act(() => {
    for (const listener of ipc.listeners) listener({ payload: { job: update } });
  });
}

function Harness() {
  useJobEvents();
  return <OutputWindow />;
}

async function renderWindow(settings: {
  showOutputWindow: boolean;
  closeOutputOnSuccess: boolean;
}) {
  ipc.getSettings.mockResolvedValue({ status: "ok", data: { jobs: settings } });
  ipc.listJobs.mockResolvedValue([]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <Harness />
    </QueryClientProvider>,
  );
  // Settings and the jobs list loaded (and applied), the listener in place.
  await waitFor(() => {
    expect(ipc.listeners.length).toBeGreaterThan(0);
    expect(ipc.getSettings).toHaveBeenCalled();
    expect(client.isFetching()).toBe(0);
  });
  await act(async () => {
    await Promise.resolve();
  });
}

describe("Git output window", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ipc.listeners.length = 0;
    closeOutput();
    forgetOwnJobs();
  });

  it("stays closed for a job another window started", async () => {
    await renderWindow({ showOutputWindow: true, closeOutputOnSuccess: false });
    emit(job(), false);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens when this window learns it started a job after its first event", async () => {
    await renderWindow({ showOutputWindow: true, closeOutputOnSuccess: false });
    emit(job(), false);
    act(() => {
      ownJob(job().id);
    });
    expect(await screen.findByRole("dialog")).toBeVisible();
  });

  it("opens for a new job, streams its output reading only new lines, and closes", async () => {
    const user = userEvent.setup();
    ipc.getJobOutput.mockResolvedValueOnce({ from: 0, lines: ["From C:/remote"] });
    await renderWindow({ showOutputWindow: true, closeOutputOnSuccess: false });
    emit(job());
    expect(await screen.findByRole("dialog", { name: "Git output" })).toBeVisible();
    expect(await screen.findByText(/From C:\/remote/)).toBeVisible();
    expect(screen.getByText("Receiving objects: 45% (9/20)")).toBeVisible();

    ipc.getJobOutput.mockResolvedValueOnce({ from: 1, lines: ["Updating 1234..5678"] });
    emit(job({ logLines: 2 }));
    expect(await screen.findByText(/Updating 1234\.\.5678/)).toBeVisible();
    expect(ipc.getJobOutput).toHaveBeenLastCalledWith(7, 1);

    emit(job({ state: "failed", logLines: 2, message: "Pull first.", progress: null }));
    expect(await screen.findByText("Failed: Pull first.")).toBeVisible();

    // Everything in it ended: the next job starts the window afresh.
    ipc.getJobOutput.mockResolvedValue({ from: 0, lines: [] });
    emit(job({ id: 9, title: "Fetch origin", logLines: 0 }));
    expect(await screen.findByText("app: Fetch origin")).toBeVisible();
    expect(screen.queryByRole("combobox", { name: "Job" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Close Git output" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes by itself once its jobs succeeded, when asked to", async () => {
    ipc.getJobOutput.mockResolvedValue({ from: 0, lines: [] });
    await renderWindow({ showOutputWindow: true, closeOutputOnSuccess: true });
    emit(job());
    emit(job({ id: 8, title: "Pull main", repoPath: "C:\\code\\web" }));
    // A batch: the first job stays on screen, the second is listed.
    expect(await screen.findByRole("combobox", { name: "Job" })).toHaveDisplayValue(
      "app: Pull main (running)",
    );
    emit(job({ state: "succeeded", message: "Already up to date", progress: null }));
    emit(job({ id: 8, repoPath: "C:\\code\\web", state: "succeeded", progress: null }));
    await waitFor(
      () => {
        expect(screen.queryByRole("dialog")).toBeNull();
      },
      { timeout: 3000 },
    );
  });

  it("stays closed while the setting is off", async () => {
    ipc.getJobOutput.mockResolvedValue({ from: 0, lines: [] });
    await renderWindow({ showOutputWindow: false, closeOutputOnSuccess: true });
    emit(job());
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

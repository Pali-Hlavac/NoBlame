/** Whether the Git output window is open, the jobs it shows and which one is on screen. */
import { create } from "zustand";

interface OutputWindowState {
  open: boolean;
  /** Jobs shown since the window opened, oldest first (a batch adds one per repository). */
  jobIds: readonly number[];
  /** The job on screen. */
  selected: number | null;
}

const CLOSED: OutputWindowState = { open: false, jobIds: [], selected: null };

export const useOutputWindow = create<OutputWindowState>(() => CLOSED);

/** A task window shows every job it starts, whatever the setting says (its only progress). */
let everyJob = false;

/** Shows the output of every job this window starts (task windows: they have no status bar). */
export function showOutputOfEveryJob(): void {
  everyJob = true;
}

/** Whether this window shows every job it starts. */
export function showsOutputOfEveryJob(): boolean {
  return everyJob;
}

/**
 * How a job joins the window: `replace` its jobs (they all ended: a new action starts afresh),
 * `add` it to the list (others still run, as in a batch), or add and `select` it (the user
 * asked for it).
 */
export type ShowOutput = "replace" | "add" | "select";

/** Shows `job` in the output window; a closed window opens with only this job. */
export function showOutput(job: number, how: ShowOutput): void {
  useOutputWindow.setState((state) => {
    if (!state.open || how === "replace") return { open: true, jobIds: [job], selected: job };
    const jobIds = state.jobIds.includes(job) ? state.jobIds : [...state.jobIds, job];
    return { jobIds, selected: how === "select" ? job : state.selected };
  });
}

export function selectOutput(job: number): void {
  useOutputWindow.setState({ selected: job });
}

/** Closes the window and forgets its jobs (they go on running in the background). */
export function closeOutput(): void {
  useOutputWindow.setState(CLOSED);
}

/** Whether the jobs list (the status bar's popover) is open, and which job's log it shows. */
import { create } from "zustand";

interface JobsPanelState {
  open: boolean;
  /** The job whose log is unfolded, if any. */
  expanded: number | null;
}

export const useJobsPanel = create<JobsPanelState>(() => ({ open: false, expanded: null }));

/** Opens the jobs list, with `job`'s log unfolded when given. */
export function showJobs(job?: number): void {
  useJobsPanel.setState((state) => ({ open: true, expanded: job ?? state.expanded }));
}

export function setJobsOpen(open: boolean): void {
  useJobsPanel.setState({ open });
}

export function toggleJobLog(job: number): void {
  useJobsPanel.setState((state) => ({ expanded: state.expanded === job ? null : job }));
}

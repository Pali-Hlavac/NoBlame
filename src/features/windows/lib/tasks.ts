/** Display data for task windows; the list mirrors `TaskKind` in `src-tauri/src/cli/task.rs`. */
import type { TaskKind } from "@/shared/ipc/bindings";

export interface TaskInfo {
  /** Window and palette title. */
  title: string;
  /** Subcommand, as in `noblame <command> <path>`. */
  command: string;
  description: string;
}

export const TASKS: Record<TaskKind, TaskInfo> = {
  log: { title: "Log", command: "log", description: "Commit graph and history." },
  commit: { title: "Commit", command: "commit", description: "Stage changes and commit." },
  diff: { title: "Diff", command: "diff", description: "Changes in the working tree." },
  blame: { title: "Blame", command: "blame", description: "Who last changed each line." },
  fileHistory: { title: "File history", command: "filehistory", description: "A file's history." },
  pull: { title: "Pull", command: "pull", description: "Fetch and integrate changes." },
  push: { title: "Push", command: "push", description: "Push commits to a remote." },
  fetch: { title: "Fetch", command: "fetch", description: "Download from remotes." },
  switch: { title: "Switch branch", command: "switch", description: "Switch to another branch." },
  merge: { title: "Merge", command: "merge", description: "Merge a branch." },
  rebase: { title: "Rebase", command: "rebase", description: "Rebase the current branch." },
  stash: { title: "Stash", command: "stash", description: "Stash or restore changes." },
  clone: { title: "Clone", command: "clone", description: "Clone a repository." },
  init: { title: "Create repository", command: "init", description: "Create a new repository." },
};

/** Milestone in `docs/roadmap.md` that delivers the real task windows. */
export const TASK_WINDOWS_MILESTONE = "M8";

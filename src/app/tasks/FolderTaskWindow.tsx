import { useEffect } from "react";

import { CredentialPrompt } from "@/features/credentials";
import { OutputWindow, showOutputOfEveryJob, useJobEvents } from "@/features/jobs";
import { TaskBar } from "@/features/windows";
import type { TaskKind } from "@/shared/ipc/bindings";

import { FOLDER_TASKS } from "./folderTasks";

/** The Clone and Create repository windows: the task's bar and its form. */
export function FolderTaskWindow({ task, path }: { task: TaskKind; path: string }) {
  useJobEvents();
  useEffect(() => {
    // No status bar: the Git output window is how a clone shows its progress.
    showOutputOfEveryJob();
  }, []);
  const Task = FOLDER_TASKS[task];
  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <TaskBar task={task} path={path} canOpen={false} />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-xl p-6">{Task ? <Task path={path} /> : null}</div>
      </main>
      <CredentialPrompt />
      <OutputWindow />
    </div>
  );
}

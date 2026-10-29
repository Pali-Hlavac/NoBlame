import { ConstructionIcon } from "lucide-react";

import { CLI_NAME } from "@/app.config";
import { GitNotice } from "@/features/git-env";
import type { TaskKind } from "@/shared/ipc/bindings";

import { TASK_WINDOWS_MILESTONE, TASKS } from "../lib/tasks";

interface TaskWindowViewProps {
  task: TaskKind;
  path: string;
}

/**
 * Content of a task window. M1 proves the plumbing (command line → running instance →
 * window with its own context); the task UIs themselves are built in M8.
 */
export function TaskWindowView({ task, path }: TaskWindowViewProps) {
  const info = TASKS[task];
  return (
    <main className="mx-auto flex h-full max-w-xl flex-col justify-center gap-6 p-8">
      <header className="flex items-center gap-3">
        <img src="/songbird.png" alt="" className="h-12 w-auto" />
        <div>
          <h1 className="text-xl font-semibold">{info.title}</h1>
          <p className="text-sm break-all text-muted-foreground select-text">{path}</p>
        </div>
      </header>
      <GitNotice />
      <section
        aria-label="Placeholder"
        className="flex gap-3 rounded-md border border-dashed border-border p-4 text-sm"
      >
        <ConstructionIcon className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
        <div className="grid gap-1">
          <p className="font-medium">
            Placeholder: the {info.title.toLowerCase()} window arrives in milestone{" "}
            {TASK_WINDOWS_MILESTONE}.
          </p>
          <p className="text-muted-foreground">
            {info.description} This window was opened with{" "}
            <code className="font-mono">
              {CLI_NAME} {info.command}
            </code>{" "}
            and already knows its task and path.
          </p>
        </div>
      </section>
    </main>
  );
}

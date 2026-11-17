import { AppWindowIcon } from "lucide-react";
import { toast } from "sonner";

import type { TaskKind } from "@/shared/ipc/bindings";
import { toIpcError } from "@/shared/ipc/client";
import { Button } from "@/shared/ui/button";

import { openInMainWindow } from "../api/windowContext";
import { TASKS } from "../lib/tasks";

interface TaskBarProps {
  task: TaskKind;
  /** The path the window was opened on. */
  path: string;
  /** The repository, once it is open: its name and its top folder. */
  repository?: { name: string; path: string };
  /** The folder or file inside it the window shows (relative); empty for all of it. */
  scope?: string;
  /** The task's own button (`Pull…`), which opens its dialog again. */
  action?: { label: string; onClick: () => void };
  /** Offers **Open in NoBlame**; not for Clone and Create repository (no repository yet). */
  canOpen?: boolean;
}

/**
 * The top of a task window: which task, on which repository and folder or file, and a way
 * to the main window with that repository.
 */
export function TaskBar({ task, path, repository, scope, action, canOpen = true }: TaskBarProps) {
  const open = (): void => {
    // The repository's top folder: its tab there is the whole repository, titled with its name.
    openInMainWindow(repository?.path ?? path).catch((error: unknown) => {
      const { message, hint } = toIpcError(error);
      toast.error(message, { description: hint ?? undefined });
    });
  };
  return (
    <header
      aria-label="Task"
      className="flex h-10 shrink-0 items-center gap-3 border-b border-border px-3 text-sm"
    >
      <img src="/songbird.png" alt="" className="h-6 w-auto" />
      <h1 className="font-semibold">{TASKS[task].title}</h1>
      <p className="flex min-w-0 items-baseline gap-1.5 text-muted-foreground" title={path}>
        <span className="truncate text-foreground">{repository?.name ?? path}</span>
        {scope ? <span className="truncate font-mono text-xs select-text">{scope}</span> : null}
      </p>
      {action ? (
        <Button variant="outline" size="sm" className="ml-auto" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
      {canOpen ? (
        <Button
          variant="ghost"
          size="sm"
          className={action ? undefined : "ml-auto"}
          title="Show this repository in the main window"
          onClick={open}
        >
          <AppWindowIcon aria-hidden />
          Open in NoBlame
        </Button>
      ) : null}
    </header>
  );
}

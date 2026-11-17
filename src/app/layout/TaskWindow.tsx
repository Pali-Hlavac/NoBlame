import { useEffect, useMemo } from "react";

import { APP_NAME } from "@/app.config";

import { useJobEvents } from "@/features/jobs";
import { repositoryName, useRepositoryChanges, useSessionCleanup } from "@/features/repositories";
import { TASKS, TaskBar } from "@/features/windows";
import { Workbench, useModulePopupOpen } from "@/features/workbench";
import { useTabHotkeys } from "@/features/workspace";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import type { TaskKind } from "@/shared/ipc/bindings";

import { useHistoryHotkeys } from "../commands/useHistoryHotkeys";
import { FolderTaskWindow } from "../tasks/FolderTaskWindow";
import { FOLDER_TASKS } from "../tasks/folderTasks";
import { RefPickDialog } from "../tasks/RefPickDialog";
import { RemoteTaskDialog } from "../tasks/RemoteTaskDialog";
import { currentBranch } from "../tasks/remote";
import { TASK_SPECS, type TaskSpec, type TaskTarget } from "../tasks/specs";
import { useCloseWhenDone } from "../tasks/useCloseWhenDone";
import { useTaskTarget } from "../tasks/useTaskTarget";
import { MODULES } from "../workbench/modules";
import { renderTab } from "./renderTab";
import { RepositoryContexts, WindowDialogs } from "./WindowParts";

interface TaskWindowProps {
  task: TaskKind;
  /** The path given on the command line. */
  path: string;
}

/**
 * A task window (`noblame log <path>`, ADR 0015): the bar naming the task and the workbench
 * with the task's modules and tabs; Clone and Create repository show their form instead.
 */
export function TaskWindow({ task, path }: TaskWindowProps) {
  const spec = TASK_SPECS[task];
  useEffect(() => {
    // As the window's own title (set in Rust), for tools that list pages by title.
    document.title = `${TASKS[task].title} — ${repositoryName(path)} — ${APP_NAME}`;
  }, [task, path]);
  if (spec) return <PreparedTask task={task} path={path} spec={spec} />;
  if (FOLDER_TASKS[task]) return <FolderTaskWindow task={task} path={path} />;
  return (
    <ErrorState
      error={new Error(`NoBlame has no ${TASKS[task].title} window.`)}
      title="Unknown task"
      className="h-screen justify-center"
    />
  );
}

function PreparedTask({ task, path, spec }: TaskWindowProps & { spec: TaskSpec }) {
  const { session, target } = useTaskTarget(path, spec);
  useCloseWhenDone(task);
  // A popped-out module's popup is modal: the window behind waits until it closes.
  const popupOpen = useModulePopupOpen();
  const error = session.error ?? target.error;
  const retry = (): void => {
    void (session.error ? session.refetch() : target.refetch());
  };
  return (
    <div className="flex h-screen flex-col bg-background text-foreground" inert={popupOpen}>
      <TaskBar
        task={task}
        path={path}
        repository={session.data}
        scope={target.data?.scope?.relative}
        action={actionOf(spec, target.data)}
      />
      {error ? (
        <ErrorState
          error={error}
          title={`Could not open ${repositoryName(path)}`}
          onRetry={retry}
          className="flex-1 justify-center"
        />
      ) : target.data ? (
        <TaskWorkbench spec={spec} target={target.data} />
      ) : (
        <LoadingState label="Opening repository…" className="flex-1" />
      )}
    </div>
  );
}

/** The bar's button that opens the task's dialog again (Pull…), once the window is ready. */
function actionOf(spec: TaskSpec, target: TaskTarget | undefined) {
  const { start, startLabel } = spec;
  if (!start || !startLabel || !target) return undefined;
  return {
    label: startLabel,
    onClick: () => {
      start(target);
    },
  };
}

/**
 * The workbench of a task window: the task's modules, its layout never saved. A task with a
 * dialog (Pull, Push, Switch, Stash) opens it once the window is ready.
 */
function TaskWorkbench({ spec, target }: { spec: TaskSpec; target: TaskTarget }) {
  const modules = useMemo(
    () => MODULES.filter((module) => spec.modules.includes(module.id)),
    [spec],
  );
  useSessionCleanup();
  useRepositoryChanges();
  useJobEvents();
  useTabHotkeys();
  useHistoryHotkeys();
  useEffect(() => {
    // Opening is idempotent, so StrictMode's second run changes nothing.
    spec.start?.(target);
  }, [spec, target]);
  return (
    <>
      <RepositoryContexts>
        <Workbench
          modules={modules}
          defaultModuleLayout={spec.moduleLayout}
          renderTab={renderTab}
          saved={null}
          persist={false}
          sidebarWidthPx={spec.sidebarWidthPx}
        />
      </RepositoryContexts>
      <WindowDialogs />
      <RemoteTaskDialog repoPath={target.summary.path} branch={currentBranch(target)} />
      <RefPickDialog repoId={target.summary.id} />
    </>
  );
}

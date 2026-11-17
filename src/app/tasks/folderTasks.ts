/** Tasks about a folder that is not a repository yet: they show a form, not a workbench. */
import type { ComponentType } from "react";

import type { TaskKind } from "@/shared/ipc/bindings";

import { CloneTask } from "./CloneTask";
import { InitTask } from "./InitTask";

export const FOLDER_TASKS: Partial<Record<TaskKind, ComponentType<{ path: string }>>> = {
  clone: CloneTask,
  init: InitTask,
};

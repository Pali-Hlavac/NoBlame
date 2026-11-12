/** Public API of the windows feature (window context, task windows, CLI requests). */
export { openInMainWindow, useOpenTaskWindow, useWindowContext } from "./api/windowContext";
export { TaskBar } from "./components/TaskBar";
export { TaskWindowView } from "./components/TaskWindowView";
export { useRepositoryRequests } from "./hooks/useRepositoryRequests";
export { TASKS, TASK_WINDOWS_MILESTONE } from "./lib/tasks";

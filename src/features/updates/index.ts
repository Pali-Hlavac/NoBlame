/**
 * Public API of the updates feature (ADR 0017): whether this build updates itself, the check
 * after starting, About's Check for updates, and the dialog installing a new release.
 */
export { checkForUpdate, useUpdateSupport } from "./api/updates";
export { UpdateCheck } from "./components/UpdateCheck";
export { UpdateDialog } from "./components/UpdateDialog";
export { useStartupUpdateCheck } from "./hooks/useStartupUpdateCheck";
export { showUpdate } from "./store/updates";

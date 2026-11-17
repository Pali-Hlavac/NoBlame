/**
 * Public API of the stashes feature: the Stashes module, the Stash tab and the "Stash changes"
 * dialog (mounted once per window, opened with `openStashChanges`).
 */
export { StashChangesDialog } from "./components/StashChangesDialog";
export { StashesModule } from "./components/StashesModule";
export { StashView } from "./components/StashView";
export { openStashChanges } from "./store/stashDialog";

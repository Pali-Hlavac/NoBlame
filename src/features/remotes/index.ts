/**
 * Public API of the remotes feature: the Remotes dialog (add, edit, remove) and Clone (the
 * dialog, and its form for the Clone window).
 */
export { CloneForm, type CloneStarted } from "./components/CloneForm";
export { RemoteDialogs } from "./components/RemoteDialogs";
export { openClone, openRemotes } from "./store/dialog";

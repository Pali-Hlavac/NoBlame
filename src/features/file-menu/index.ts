/**
 * Public API of the file menu: the context menu of a file in any list (Changed files, Commit,
 * Compare, Stash), and opening, showing or saving a file.
 */
export { openWorktreeFile, showWorktreeFile } from "./api/open";
export { saveFileAs } from "./api/save";
export { FileContextMenu, type MenuAction, type MenuFile } from "./components/FileContextMenu";

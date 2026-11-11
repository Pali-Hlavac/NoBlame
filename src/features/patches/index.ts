/**
 * Public API of the patches feature: creating patches of a commit or a range, applying patch
 * files (as commits or to the files only), and saving an archive of a commit.
 */
export { PatchDialogs } from "./components/PatchDialogs";
export { openApplyPatches, openArchive, openCreatePatches } from "./store/dialog";

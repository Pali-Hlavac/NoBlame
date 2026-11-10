/** Public API of the Branches module, and the branch and tag actions and dialogs. */
export { BranchesModule } from "./components/BranchesModule";
export { BranchDialogs } from "./components/BranchDialogs";
export { useRefActions } from "./hooks/useRefActions";
export { pushCurrentBranch } from "./lib/pushCurrent";
export { openBranchDialog } from "./store/dialog";
export { newNameProblem, refNameProblem } from "./lib/names";

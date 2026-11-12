/** Public API of the repositories feature: tabs, sessions, recent list, open and create. */
export { ActiveRepositoryStatus } from "./components/ActiveRepositoryStatus";
export { RecentRepositories } from "./components/RecentRepositories";
export { RepositoriesModule } from "./components/RepositoriesModule";
export { RepositoryView } from "./components/RepositoryView";
export { WithActiveRepository } from "./components/WithActiveRepository";
export { useActiveRepository, type ActiveRepository } from "./hooks/useActiveRepository";
export { useRepositoryChanges } from "./hooks/useRepositoryChanges";
export { useRepositoryPath } from "./hooks/useRepositoryPath";
export { useSessionCleanup } from "./hooks/useSessionCleanup";
export { useRecentRepositories } from "./api/recent";
export { fetchPathScope } from "./api/scope";
export { useRepositorySession } from "./api/session";
export { submoduleKeys } from "./api/submodules";
export {
  openRepositories,
  pickFolder,
  useCreateRepository,
  useOpenRepository,
} from "./hooks/useOpenRepository";
export {
  CloneRepositoryContext,
  RepositoryBannerContext,
  GroupActionsContext,
  RepositoryActionsContext,
  type GroupAction,
  type GroupTarget,
  type RepositoryAction,
  type RepositoryTarget,
} from "./lib/actions";
export { repositoryName, repositoryTab } from "./lib/path";

/** Public API of the repositories feature: tabs, sessions, recent list, open and create. */
export { ActiveRepositoryStatus } from "./components/ActiveRepositoryStatus";
export { RecentRepositories } from "./components/RecentRepositories";
export { RepositoriesModule } from "./components/RepositoriesModule";
export { RepositoryView } from "./components/RepositoryView";
export { WithActiveRepository } from "./components/WithActiveRepository";
export { useActiveRepository, type ActiveRepository } from "./hooks/useActiveRepository";
export { useSessionCleanup } from "./hooks/useSessionCleanup";
export {
  openRepositories,
  useCreateRepository,
  useOpenRepository,
} from "./hooks/useOpenRepository";
export {
  RepositoryActionsContext,
  type RepositoryAction,
  type RepositoryTarget,
} from "./lib/actions";
export { repositoryName, repositoryTab } from "./lib/path";

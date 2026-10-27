/** Public API of the repositories feature (repository tabs; reading repos arrives in M2). */
export { RepositoryList } from "./components/RepositoryList";
export { RepositoryView } from "./components/RepositoryView";
export { openRepositories, useOpenRepository } from "./hooks/useOpenRepository";
export { repositoryName, repositoryTab } from "./lib/path";

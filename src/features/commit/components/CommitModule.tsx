import { WithActiveRepository } from "@/features/repositories";

import { CommitPanel } from "./CommitPanel";

/** The Commit module: stage the active repository's changes and commit them. */
export function CommitModule() {
  return (
    <WithActiveRepository>
      {(summary, tab) => <CommitPanel repoId={summary.id} repoPath={tab.path} showDiff />}
    </WithActiveRepository>
  );
}

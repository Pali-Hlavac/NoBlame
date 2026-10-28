import { FileDiffIcon, FileQuestionIcon, MousePointerClickIcon } from "lucide-react";
import { useEffect } from "react";

import { useChangedFiles } from "@/features/changed-files";
import { WithActiveRepository } from "@/features/repositories";
import { useComparedParent, useSelectedFile, useSelection } from "@/features/selection";
import { WORKING_TREE_MILESTONE } from "@/features/working-tree";
import { DIFF_TAB, useTabsStore } from "@/features/workspace";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";

import { diffTabTitle } from "../lib/format";
import { FileDiffView } from "./FileDiffView";

interface CommitFileProps {
  repoId: number;
  repoPath: string;
  row: number;
  path: string;
}

/** Finds the chosen path among the commit's changes (the list is cached, shared with the module). */
function CommitFile({ repoId, repoPath, row, path }: CommitFileProps) {
  const parent = useComparedParent(repoPath);
  const changes = useChangedFiles(repoId, row, parent);
  if (changes.error) {
    return (
      <ErrorState
        error={changes.error}
        title="Could not read the changes"
        onRetry={() => void changes.refetch()}
        className="h-full justify-center"
      />
    );
  }
  if (!changes.data) return <LoadingState label="Comparing…" className="h-full" />;
  const file = changes.data.files.find((changed) => changed.path === path);
  if (!file) {
    return (
      <EmptyState
        icon={FileQuestionIcon}
        title="Not changed in this commit"
        description={`${path} did not change here. Choose a file in Changed files.`}
        className="h-full"
      />
    );
  }
  return <FileDiffView repoId={repoId} file={file} />;
}

function SelectedDiff({ repoId, repoPath }: { repoId: number; repoPath: string }) {
  const selection = useSelection(repoPath);
  const path = useSelectedFile(repoPath);

  useEffect(() => {
    useTabsStore.getState().setTitle(DIFF_TAB.id, diffTabTitle(path));
  }, [path]);

  if (selection && selection.kind !== "commit") {
    return (
      <EmptyState
        icon={FileDiffIcon}
        title="Uncommitted changes"
        description={`Their diffs arrive with staging in ${WORKING_TREE_MILESTONE}.`}
        className="h-full"
      />
    );
  }
  if (!selection || path === undefined) {
    return (
      <EmptyState
        icon={MousePointerClickIcon}
        title="No file chosen"
        description="Select a commit, then a file in Changed files (Alt+5)."
        className="h-full"
      />
    );
  }
  return <CommitFile repoId={repoId} repoPath={repoPath} row={selection.row} path={path} />;
}

/**
 * The diff tab: the diff of the file chosen in Changed files, for the active repository's
 * selected commit. There is one; choosing another file switches it in place.
 */
export function DiffView() {
  return (
    <WithActiveRepository>
      {(summary, tab) => <SelectedDiff repoId={summary.id} repoPath={tab.path} />}
    </WithActiveRepository>
  );
}

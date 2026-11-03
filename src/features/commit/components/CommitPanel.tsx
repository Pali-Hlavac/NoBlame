import { CommitMessage } from "./CommitMessage";
import { StagingLists } from "./StagingLists";

interface CommitPanelProps {
  repoId: number;
  repoPath: string;
  /** Choosing a file shows the diff tab (the module); the dialog shows the diff itself. */
  showDiff: boolean;
  onCommitted?: (output: string) => void;
}

/** Changed and staged files above the message: the content of the module and the dialog. */
export function CommitPanel({ repoId, repoPath, showDiff, onCommitted }: CommitPanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <StagingLists repoId={repoId} repoPath={repoPath} showDiff={showDiff} />
      <CommitMessage repoId={repoId} repoPath={repoPath} onCommitted={onCommitted} />
    </div>
  );
}

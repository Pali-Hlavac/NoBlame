import { CommitMessage } from "./CommitMessage";
import { StagingLists } from "./StagingLists";

interface CommitPanelProps {
  repoId: number;
  repoPath: string;
  /** Choosing a file shows the diff tab (docked); popped out, the module shows the diff itself. */
  showDiff: boolean;
  onCommitted?: (output: string) => void;
}

/** Changed and staged files above the message: the Commit module, docked or popped out. */
export function CommitPanel({ repoId, repoPath, showDiff, onCommitted }: CommitPanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* The lists take what the message leaves; the message never takes more than most. */}
      <div className="flex min-h-32 flex-1 flex-col">
        <StagingLists repoId={repoId} repoPath={repoPath} showDiff={showDiff} />
      </div>
      <div className="max-h-[70%] shrink-0 overflow-y-auto">
        <CommitMessage repoId={repoId} repoPath={repoPath} onCommitted={onCommitted} />
      </div>
    </div>
  );
}

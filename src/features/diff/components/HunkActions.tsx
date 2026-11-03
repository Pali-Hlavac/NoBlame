import { MinusIcon, PlusIcon, Undo2Icon, type LucideIcon } from "lucide-react";
import { useContext } from "react";

import type { LineAction, WorkingTreeKind } from "@/features/working-tree";
import { Button } from "@/shared/ui/button";

import { LineStagingContext } from "../hooks/useLineStaging";
import { hunkLines } from "../lib/lineSelection";

interface HunkAction {
  action: LineAction;
  label: string;
  icon: LucideIcon;
}

const ACTIONS: Readonly<Record<WorkingTreeKind, readonly HunkAction[]>> = {
  worktree: [
    { action: "stage", label: "Stage hunk", icon: PlusIcon },
    { action: "discard", label: "Discard hunk…", icon: Undo2Icon },
  ],
  index: [{ action: "unstage", label: "Unstage hunk", icon: MinusIcon }],
};

/**
 * Buttons on a hunk header of a working tree diff: stage or discard the hunk's changes, or
 * unstage them in a staged diff. Nothing for other diffs.
 */
export function HunkActions({ header }: { header: string }) {
  const staging = useContext(LineStagingContext);
  const lines = hunkLines(header);
  if (!staging || !lines) return null;
  const first = lines.added[0]?.start ?? lines.removed[0]?.start ?? 0;
  const last = lines.added[0]?.end ?? lines.removed[0]?.end ?? first;
  return (
    <span className="sticky right-0 ml-auto flex shrink-0 items-center gap-1 bg-diff-hunk px-1 font-sans">
      {ACTIONS[staging.kind].map(({ action, label, icon: Icon }) => (
        <Button
          key={action}
          variant="ghost"
          size="sm"
          className="h-5 gap-1 px-1.5 text-xs"
          disabled={staging.busy}
          onClick={() => {
            staging.run(action, lines, `the hunk at lines ${first}–${last}`);
          }}
        >
          <Icon aria-hidden />
          {label}
        </Button>
      ))}
    </span>
  );
}

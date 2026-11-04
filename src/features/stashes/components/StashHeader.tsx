import { ArchiveRestoreIcon, FileCheckIcon, PackageOpenIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import { formatCommitDate } from "@/features/graph";
import type { StashDto, StashFilesDto } from "@/shared/ipc/bindings";
import { Button } from "@/shared/ui/button";

import { useApplyStashFiles } from "../api/stashes";
import { reportApplied, useStashActions } from "../hooks/useStashActions";
import { applyRequest, stashDescription, stashName, type StashFile } from "../lib/files";
import { chooseStashFiles, setRestoreIndex, useShownStashStore } from "../store/shown";
import { DropStashDialog } from "./DropStashDialog";

interface StashHeaderProps {
  repoId: number;
  repoPath: string;
  stash: StashDto;
  files: readonly StashFile[];
  /** Keys of the files chosen to apply. */
  chosen: readonly string[];
  listed: StashFilesDto;
}

/** The stash's name, message and date, and what can be done with it. */
export function StashHeader({ repoId, repoPath, stash, files, chosen, listed }: StashHeaderProps) {
  const actions = useStashActions(repoId, repoPath);
  const applyFiles = useApplyStashFiles(repoId);
  const restoreIndex = useShownStashStore((state) => state.restoreIndex);
  const [dropping, setDropping] = useState(false);
  const busy = actions.busy || applyFiles.isPending;
  const total = listed.changedTotal + listed.untrackedTotal;
  const allChosen = files.length > 0 && chosen.length === files.length;

  const applyChosen = (): void => {
    applyFiles.mutate(applyRequest(stash.id, files, chosen), {
      onSuccess: (outcome) => {
        const count = chosen.length === 1 ? "1 file" : `${chosen.length} files`;
        reportApplied(`Applied ${count} from ${stashName(stash)}`, outcome, true);
        chooseStashFiles(repoPath, chosen, false);
      },
    });
  };

  return (
    <div className="flex shrink-0 flex-col gap-1.5 border-b border-border px-3 py-2">
      <div className="flex min-w-0 items-baseline gap-2">
        <code className="shrink-0 font-mono text-xs text-muted-foreground">{stashName(stash)}</code>
        <span className="truncate text-sm font-medium" title={stash.message}>
          {stashDescription(stash)}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {stash.branch ? `on ${stash.branch} · ` : ""}
          {formatCommitDate(stash.time)} · {total.toLocaleString()} {total === 1 ? "file" : "files"}
          {total > files.length && ` (first ${files.length.toLocaleString()} shown)`}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => {
            actions.apply(stash);
          }}
        >
          <ArchiveRestoreIcon aria-hidden />
          Apply
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          title="Apply, then drop the stash unless it conflicts"
          onClick={() => {
            actions.pop(stash);
          }}
        >
          <PackageOpenIcon aria-hidden />
          Pop
        </Button>
        <label className="flex items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            className="size-4 accent-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            checked={restoreIndex}
            onChange={(event) => {
              setRestoreIndex(event.target.checked);
            }}
          />
          Restore staged changes too
        </label>
        <span className="flex-1" />
        <Button
          size="sm"
          variant="ghost"
          disabled={files.length === 0}
          onClick={() => {
            chooseStashFiles(
              repoPath,
              files.map((file) => file.key),
              !allChosen,
            );
          }}
        >
          {allChosen ? "Choose none" : "Choose all"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || chosen.length === 0}
          title="Merge the changes of the chosen files into the working tree; the stash is kept"
          onClick={applyChosen}
        >
          <FileCheckIcon aria-hidden />
          {chosen.length === 0 ? "Apply chosen files" : `Apply ${chosen.length} chosen`}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          className="text-destructive hover:text-destructive"
          onClick={() => {
            setDropping(true);
          }}
        >
          <Trash2Icon aria-hidden />
          Drop…
        </Button>
      </div>
      <DropStashDialog
        repoId={repoId}
        repoPath={repoPath}
        stash={dropping ? stash : null}
        onClose={() => {
          setDropping(false);
        }}
      />
    </div>
  );
}

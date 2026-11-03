import { GitCommitVerticalIcon } from "lucide-react";
import { useId, useState } from "react";

import { useStatusSummary } from "@/features/working-tree";
import { toIpcError } from "@/shared/ipc/client";
import { formatHotkey, matchesHotkey } from "@/shared/lib/hotkeys";
import { isMacPlatform } from "@/shared/lib/platform";
import { Button } from "@/shared/ui/button";

import { useCreateCommit, useFetchHeadMessage } from "../api/commit";
import { amendOff, amendOn, changeDraft, clearDraft, draftOf, useDraft } from "../store/draft";
import { CommitOutput } from "./CommitOutput";

/** Commits from the message box. */
export const COMMIT_HOTKEY = "mod+enter";

interface CommitMessageProps {
  repoId: number;
  repoPath: string;
  /** Called with git's output after a commit (the dialog closes). */
  onCommitted?: (output: string) => void;
}

/** Why the Commit button is disabled, or null when it is not. */
function blocker(message: string, staged: number | undefined, amend: boolean): string | null {
  if (staged === 0 && !amend) return "Stage the changes to commit first.";
  if (message.trim() === "") return "Write a message.";
  return null;
}

/** The message box, Amend and Sign off, the Commit button, and what git and its hooks printed. */
export function CommitMessage({ repoId, repoPath, onCommitted }: CommitMessageProps) {
  const id = useId();
  const draft = useDraft(repoPath);
  const staged = useStatusSummary(repoId).data?.staged;
  const fetchHeadMessage = useFetchHeadMessage(repoId);
  const create = useCreateCommit(repoId);
  const [output, setOutput] = useState<string | null>(null);
  const isMac = isMacPlatform();
  const reason = blocker(draft.message, staged, draft.amend);

  const commit = (): void => {
    if (reason !== null || create.isPending) return;
    setOutput(null);
    create.mutate(
      { message: draft.message, amend: draft.amend, signOff: draft.signOff },
      {
        onSuccess: (result) => {
          clearDraft(repoPath);
          setOutput(result.output);
          onCommitted?.(result.output);
        },
      },
    );
  };

  const toggleAmend = (checked: boolean): void => {
    if (!checked) {
      changeDraft(repoPath, amendOff(draft));
      return;
    }
    fetchHeadMessage().then(
      (message) => {
        changeDraft(repoPath, amendOn(draftOf(repoPath), message));
      },
      () => {
        changeDraft(repoPath, { amend: true });
      },
    );
  };

  return (
    <div className="flex shrink-0 flex-col gap-2 border-t border-border p-2">
      <label htmlFor={`${id}-message`} className="sr-only">
        Commit message
      </label>
      <textarea
        id={`${id}-message`}
        value={draft.message}
        placeholder="Commit message"
        rows={4}
        spellCheck
        className="min-h-16 resize-y rounded-md border border-border bg-background px-2 py-1.5 font-mono text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
        onChange={(event) => {
          changeDraft(repoPath, { message: event.target.value });
        }}
        onKeyDown={(event) => {
          if (!matchesHotkey(event.nativeEvent, COMMIT_HOTKEY, isMac)) return;
          event.preventDefault();
          commit();
        }}
      />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            className="size-4 accent-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            checked={draft.amend}
            onChange={(event) => {
              toggleAmend(event.target.checked);
            }}
          />
          Amend last commit
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            className="size-4 accent-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            checked={draft.signOff}
            onChange={(event) => {
              changeDraft(repoPath, { signOff: event.target.checked });
            }}
          />
          Sign off
        </label>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          disabled={reason !== null || create.isPending}
          title={reason ?? `Commit (${formatHotkey(COMMIT_HOTKEY, isMac)})`}
          onClick={commit}
        >
          <GitCommitVerticalIcon aria-hidden />
          {create.isPending ? "Committing…" : draft.amend ? "Amend" : "Commit"}
        </Button>
        {reason && <span className="text-xs text-muted-foreground">{reason}</span>}
      </div>
      {create.error ? (
        <CommitOutput tone="error" text={toIpcError(create.error).message} />
      ) : (
        output && <CommitOutput tone="success" text={output} />
      )}
    </div>
  );
}

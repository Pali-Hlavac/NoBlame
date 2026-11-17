import { GitCommitVerticalIcon } from "lucide-react";
import { type KeyboardEvent, useId, useState } from "react";

import { statusScope, useWorkingTreeStatus } from "@/features/working-tree";
import { toIpcError } from "@/shared/ipc/client";
import { useKeys } from "@/shared/hooks/useKeys";
import { matchesHotkey, withHotkey } from "@/shared/lib/hotkeys";
import { isMacPlatform } from "@/shared/lib/platform";
import { Button } from "@/shared/ui/button";
import { actionDone } from "@/shared/lib/actionDone";

import { useCommitDefaults, useCreateCommit } from "../api/commit";
import { useTemplateSeed } from "../hooks/useTemplateSeed";
import { isAuthor, withoutComments } from "../lib/message";
import {
  type CommitDraft,
  changeDraft,
  clearDraft,
  fromRecent,
  fromTemplate,
  typed,
  useDraft,
} from "../store/draft";
import { useCommitLayout } from "../store/layout";
import { AuthorLine } from "./AuthorLine";
import { CommitOptions } from "./CommitOptions";
import { CommitOutput } from "./CommitOutput";
import { MessageBox } from "./MessageBox";
import { FoldedSummary, MessageFold } from "./MessageFold";
import { MessageMenu } from "./MessageMenu";
import { SummaryHint } from "./SummaryHint";

/** Commits from the message box. */

/** Comment lines start with this when the config does not say otherwise. */
const DEFAULT_COMMENT_CHAR = "#";

interface CommitMessageProps {
  repoId: number;
  repoPath: string;
  /** Called with git's output after a commit (a popped-out module closes). */
  onCommitted?: (output: string) => void;
}

/** Why the Commit button is disabled, or null when it is not. */
function blocker(draft: CommitDraft, stored: string, staged: number | undefined): string | null {
  if (staged === 0 && !draft.amend) return "Stage the changes to commit first.";
  if (draft.template !== null && draft.message === draft.template) {
    return "Fill in the template first.";
  }
  if (stored.trim() === "") return "Write a message.";
  if (draft.author !== null && !isAuthor(draft.author)) return "Write the author as Name <email>.";
  return null;
}

/**
 * The message box with recent messages and the template, its summary hints, the options (Amend,
 * Sign off, author), the Commit button, and what git and its hooks printed.
 */
export function CommitMessage({ repoId, repoPath, onCommitted }: CommitMessageProps) {
  const id = useId();
  const draft = useDraft(repoPath);
  const status = useWorkingTreeStatus(repoId).data;
  // Limited to a folder (a task window), the files staged elsewhere are committed too.
  const outside = status?.stagedOutside ?? 0;
  const staged = status ? status.summary.staged + outside : undefined;
  const defaults = useCommitDefaults(repoId).data;
  const create = useCreateCommit(repoId);
  const [output, setOutput] = useState<string | null>(null);
  const folded = useCommitLayout((state) => state.folded);
  const isMac = isMacPlatform();
  const commitKeys = useKeys("commit.commit");
  const template = defaults?.template?.text ?? null;
  const commentChar = defaults?.commentChar ?? DEFAULT_COMMENT_CHAR;
  const stripComments = draft.template !== null;
  const stored = stripComments ? withoutComments(draft.message, commentChar) : draft.message;
  const reason = blocker(draft, stored, staged);
  useTemplateSeed(repoPath, draft, template);

  const commit = (): void => {
    if (reason !== null || create.isPending) return;
    setOutput(null);
    const author = draft.author === null ? null : draft.author.trim();
    create.mutate(
      { message: draft.message, amend: draft.amend, signOff: draft.signOff, author, stripComments },
      {
        onSuccess: (result) => {
          clearDraft(repoPath);
          setOutput(result.output);
          actionDone("commit");
          onCommitted?.(result.output);
        },
      },
    );
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (!commitKeys || !matchesHotkey(event.nativeEvent, commitKeys, isMac)) return;
    event.preventDefault();
    commit();
  };
  const commitButton = (
    <Button
      size="sm"
      className="h-7"
      disabled={reason !== null || create.isPending}
      title={reason ?? withHotkey("Commit", commitKeys, isMac)}
      onClick={commit}
    >
      <GitCommitVerticalIcon aria-hidden />
      {create.isPending ? "Committing…" : draft.amend ? "Amend" : "Commit"}
    </Button>
  );

  if (folded) {
    return (
      <div className="flex shrink-0 items-center gap-2 border-t border-border px-2 py-1.5">
        <MessageFold />
        <FoldedSummary message={draft.message} />
        {commitButton}
      </div>
    );
  }
  return (
    <div className="flex shrink-0 flex-col gap-1.5 border-t border-border p-2">
      <div className="flex min-w-0 items-center gap-1">
        <MessageFold />
        <MessageMenu
          repoId={repoId}
          template={template}
          onTemplate={() => {
            if (template !== null) changeDraft(repoPath, fromTemplate(template));
          }}
          onRecent={(message) => {
            changeDraft(repoPath, fromRecent(message));
          }}
        />
        <span className="ml-auto min-w-0">
          <SummaryHint message={stored} />
        </span>
      </div>
      <label htmlFor={`${id}-message`} className="sr-only">
        Commit message
      </label>
      <MessageBox
        id={`${id}-message`}
        value={draft.message}
        describedBy={stripComments ? `${id}-comments` : undefined}
        onChange={(message) => {
          changeDraft(repoPath, typed(message));
        }}
        onKeyDown={onKeyDown}
      />
      {stripComments && (
        <span id={`${id}-comments`} className="text-xs text-muted-foreground">
          From the template: lines starting with {commentChar} are left out.
        </span>
      )}
      {defaults?.template?.problem && (
        <span className="text-xs text-warning">
          The commit template {defaults.template.path} could not be read:{" "}
          {defaults.template.problem}
        </span>
      )}
      <AuthorLine
        configured={defaults?.author ?? null}
        author={draft.author}
        amend={draft.amend}
        onChange={(author) => {
          changeDraft(repoPath, { author });
        }}
      />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <CommitOptions
          repoId={repoId}
          repoPath={repoPath}
          draft={draft}
          configuredAuthor={defaults?.author ?? null}
        />
        <span className="ml-auto">{commitButton}</span>
      </div>
      {reason && <span className="text-xs text-muted-foreground">{reason}</span>}
      {outside > 0 && (
        <p className="text-xs text-warning">
          Also commits {outside} {outside === 1 ? "file" : "files"} staged outside{" "}
          <span className="font-mono">{statusScope()}</span>.
        </p>
      )}
      {create.error ? (
        <CommitOutput tone="error" text={toIpcError(create.error).message} />
      ) : (
        output && <CommitOutput tone="success" text={output} />
      )}
    </div>
  );
}

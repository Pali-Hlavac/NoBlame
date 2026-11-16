import type { ReactNode } from "react";

import { useFetchHeadMessage } from "../api/commit";
import { type CommitDraft, amendOff, amendOn, changeDraft, draftOf } from "../store/draft";
import { AuthorButton } from "./AuthorLine";

interface CommitOptionsProps {
  repoId: number;
  repoPath: string;
  draft: CommitDraft;
  /** The configured author (`Name <email>`), `null` when none is set. */
  configuredAuthor: string | null;
}

function Check({
  checked,
  onChange,
  title,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <label className="flex items-center gap-1.5 text-sm" title={title}>
      <input
        type="checkbox"
        className="size-4 accent-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        checked={checked}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
      />
      {children}
    </label>
  );
}

/** Amend, Sign off, and who the commit is by (a button; the author line is apart). */
export function CommitOptions({ repoId, repoPath, draft, configuredAuthor }: CommitOptionsProps) {
  const fetchHeadMessage = useFetchHeadMessage(repoId);

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
    <>
      <Check
        checked={draft.amend}
        onChange={toggleAmend}
        title="Change the last commit instead of adding one"
      >
        Amend
      </Check>
      <Check
        checked={draft.signOff}
        onChange={(signOff) => {
          changeDraft(repoPath, { signOff });
        }}
        title="Add a Signed-off-by line with your name"
      >
        Sign off
      </Check>
      {draft.author === null && (
        <AuthorButton
          configured={configuredAuthor}
          amend={draft.amend}
          onChange={(author) => {
            changeDraft(repoPath, { author });
          }}
        />
      )}
    </>
  );
}

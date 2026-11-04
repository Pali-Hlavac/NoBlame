import type { ReactNode } from "react";

import { useFetchHeadMessage } from "../api/commit";
import { type CommitDraft, amendOff, amendOn, changeDraft, draftOf } from "../store/draft";
import { AuthorLine } from "./AuthorLine";

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
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex items-center gap-1.5">
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

/** Amend last commit, Sign off, and who the commit is by. */
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
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <Check checked={draft.amend} onChange={toggleAmend}>
          Amend last commit
        </Check>
        <Check
          checked={draft.signOff}
          onChange={(signOff) => {
            changeDraft(repoPath, { signOff });
          }}
        >
          Sign off
        </Check>
      </div>
      <AuthorLine
        configured={configuredAuthor}
        author={draft.author}
        amend={draft.amend}
        onChange={(author) => {
          changeDraft(repoPath, { author });
        }}
      />
    </div>
  );
}

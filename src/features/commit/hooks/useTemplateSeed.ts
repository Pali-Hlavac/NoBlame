import { useEffect } from "react";

import { type CommitDraft, changeDraft, fromTemplate } from "../store/draft";

/**
 * Fills an empty, fresh draft with `commit.template`, as git's editor would: on first showing
 * and again after each commit, not when the user emptied the box or ticked Amend.
 */
export function useTemplateSeed(repoPath: string, draft: CommitDraft, template: string | null) {
  const fresh = !draft.seeded && !draft.amend && draft.message === "";
  useEffect(() => {
    if (template === null || !fresh) return;
    changeDraft(repoPath, fromTemplate(template));
  }, [repoPath, template, fresh]);
}

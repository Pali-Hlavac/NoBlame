/**
 * The commit message being written in each repository, with its options. Kept while the app
 * runs, so it survives closing the dialog or switching repositories (keyed by path: the
 * session id changes when a repository is reopened).
 */
import { create } from "zustand";

export interface CommitDraft {
  message: string;
  amend: boolean;
  signOff: boolean;
  /** The last commit's message, filled in when Amend was ticked; cleared with it if unchanged. */
  amendedMessage: string | null;
}

export const EMPTY_DRAFT: CommitDraft = {
  message: "",
  amend: false,
  signOff: false,
  amendedMessage: null,
};

interface DraftState {
  drafts: Record<string, CommitDraft | undefined>;
  change: (repoPath: string, change: Partial<CommitDraft>) => void;
}

export const useDraftStore = create<DraftState>()((set) => ({
  drafts: {},
  change: (repoPath, change) => {
    set((state) => ({
      drafts: {
        ...state.drafts,
        [repoPath]: { ...(state.drafts[repoPath] ?? EMPTY_DRAFT), ...change },
      },
    }));
  },
}));

/** The draft of `repoPath`. */
export function useDraft(repoPath: string): CommitDraft {
  return useDraftStore((state) => state.drafts[repoPath] ?? EMPTY_DRAFT);
}

/** The draft of `repoPath` now (outside React). */
export function draftOf(repoPath: string): CommitDraft {
  return useDraftStore.getState().drafts[repoPath] ?? EMPTY_DRAFT;
}

/** Changes part of the draft of `repoPath`. */
export function changeDraft(repoPath: string, change: Partial<CommitDraft>): void {
  useDraftStore.getState().change(repoPath, change);
}

/** After a commit: an empty message, Amend off; Sign off stays as the user left it. */
export function clearDraft(repoPath: string): void {
  changeDraft(repoPath, { message: "", amend: false, amendedMessage: null });
}

/** Ticking Amend fills in the last commit's message when nothing is typed yet. */
export function amendOn(draft: CommitDraft, headMessage: string | null): Partial<CommitDraft> {
  if (draft.message.trim() !== "" || headMessage === null) {
    return { amend: true, amendedMessage: null };
  }
  const message = headMessage.replace(/\n+$/, "");
  return { amend: true, message, amendedMessage: message };
}

/** Unticking Amend takes the filled-in message away again, unless it was edited. */
export function amendOff(draft: CommitDraft): Partial<CommitDraft> {
  const untouched = draft.amendedMessage !== null && draft.message === draft.amendedMessage;
  return { amend: false, amendedMessage: null, ...(untouched ? { message: "" } : {}) };
}

/**
 * The commit message being written in each repository, with its options. Kept while the app
 * runs, so it survives closing the popup or switching repositories (keyed by path: the
 * session id changes when a repository is reopened).
 */
import { create } from "zustand";

export interface CommitDraft {
  message: string;
  amend: boolean;
  signOff: boolean;
  /** The last commit's message, filled in when Amend was ticked; cleared with it if unchanged. */
  amendedMessage: string | null;
  /** Someone else as the author (`Name <email>`, as typed); `null`: the configured author. */
  author: string | null;
  /** The `commit.template` text the message started from; its comment lines are left out. */
  template: string | null;
  /** The template was filled in (or the user chose otherwise); not again until the next commit. */
  seeded: boolean;
}

export const EMPTY_DRAFT: CommitDraft = {
  message: "",
  amend: false,
  signOff: false,
  amendedMessage: null,
  author: null,
  template: null,
  seeded: false,
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

/**
 * After a commit: an empty message (the template comes back), Amend off and the configured
 * author; Sign off stays as the user left it.
 */
export function clearDraft(repoPath: string): void {
  changeDraft(repoPath, {
    message: "",
    amend: false,
    amendedMessage: null,
    author: null,
    template: null,
    seeded: false,
  });
}

/** Nothing typed yet: the box is empty or holds the template as it was filled in. */
export function isUntouched(draft: CommitDraft): boolean {
  return draft.message.trim() === "" || draft.message === draft.template;
}

/** Typing: a box emptied by hand no longer counts as started from the template. */
export function typed(message: string): Partial<CommitDraft> {
  return message.trim() === "" ? { message, template: null, seeded: true } : { message };
}

/** Starting from the template (filled in by itself, or chosen from the menu). */
export function fromTemplate(template: string): Partial<CommitDraft> {
  const message = template.replace(/\n+$/, "");
  return { message, template: message, seeded: true, amendedMessage: null };
}

/** A recent message chosen from the menu replaces the box. */
export function fromRecent(message: string): Partial<CommitDraft> {
  return { message, template: null, seeded: true, amendedMessage: null };
}

/** Ticking Amend fills in the last commit's message when nothing is typed yet. */
export function amendOn(draft: CommitDraft, headMessage: string | null): Partial<CommitDraft> {
  if (!isUntouched(draft) || headMessage === null) {
    return { amend: true, amendedMessage: null };
  }
  const message = headMessage.replace(/\n+$/, "");
  return { amend: true, message, amendedMessage: message, template: null, seeded: true };
}

/** Unticking Amend takes the filled-in message away again (the template returns), unless edited. */
export function amendOff(draft: CommitDraft): Partial<CommitDraft> {
  const untouched = draft.amendedMessage !== null && draft.message === draft.amendedMessage;
  return {
    amend: false,
    amendedMessage: null,
    ...(untouched ? { message: "", seeded: false } : {}),
  };
}

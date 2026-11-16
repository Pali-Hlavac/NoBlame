/**
 * How the Commit module is laid out, remembered between sessions (this window's storage, like
 * the theme): the shares of the Changes and Staged lists, the width of the lists beside the
 * diff when popped out, and whether the message area is folded to one line.
 */
import { create } from "zustand";

const STORAGE_KEY = "noblame.commit-layout";

/** Panel id → percent, as react-resizable-panels reports a layout. */
export type Shares = Readonly<Record<string, number>>;

export interface CommitLayout {
  /** Changes over Staged. */
  lists: Shares | null;
  /** Popped out: the lists beside the diff. */
  beside: Shares | null;
  /** The message area shows one line: the summary and the Commit button. */
  folded: boolean;
}

const DEFAULT_LAYOUT: CommitLayout = { lists: null, beside: null, folded: false };

function isShares(value: unknown): value is Shares {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.values(value).every((share) => typeof share === "number")
  );
}

/** The saved layout; anything unreadable falls back to the default. */
export function readCommitLayout(): CommitLayout {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (typeof saved !== "object" || saved === null) return DEFAULT_LAYOUT;
    const { lists, beside, folded } = saved as Record<string, unknown>;
    return {
      lists: isShares(lists) ? lists : null,
      beside: isShares(beside) ? beside : null,
      folded: folded === true,
    };
  } catch {
    return DEFAULT_LAYOUT;
  }
}

export const useCommitLayout = create<CommitLayout>(() => readCommitLayout());

/** Changes and saves part of the layout. */
export function changeCommitLayout(patch: Partial<CommitLayout>): void {
  useCommitLayout.setState(patch);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(useCommitLayout.getState()));
  } catch {
    // No storage: the layout lasts until the window closes.
  }
}

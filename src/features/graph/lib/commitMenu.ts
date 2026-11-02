/**
 * The entries of the context menu on a commit (owner request 2026-10-30; the full list is in
 * docs/roadmap.md, "Commit context menu"). Entries whose operation arrives later name the
 * milestone that delivers it and are shown disabled, like the toolbar.
 */
import type { CommitRowDto, RefLabel } from "@/shared/ipc/bindings";

import { refRevision } from "./revision";

/** Milestones of the stubbed entries (docs/roadmap.md). */
export const MENU_MILESTONES = {
  workingTree: "M4",
  branches: "M5",
  history: "M6",
  advanced: "M7",
} as const;

export type MenuEntry =
  | {
      type: "item";
      id: string;
      label: string;
      /** Shown disabled with this milestone when set. */
      milestone?: string;
      run?: () => void;
    }
  | { type: "submenu"; id: string; label: string; entries: MenuEntry[] }
  | { type: "separator"; id: string };

/** What the working entries do; the menu itself stays free of side effects. */
export interface CommitMenuActions {
  copy: (text: string, what: string) => void;
  /** Copies the whole message (read from the backend). */
  copyMessage: () => void;
  /** Whether the commit's history is highlighted now; `undefined` when highlighting is off. */
  highlighted: boolean | undefined;
  toggleHighlight: () => void;
  /** Shows the commit's files (the Files module). */
  browseFiles: () => void;
  /** Compares the commit with HEAD; `undefined` when it is HEAD. */
  compareWithHead: (() => void) | undefined;
  /** Compares the current branch with a reference (its full name) on the commit. */
  compareWithCurrent: (revision: string) => void;
}

const { workingTree, branches, history, advanced } = MENU_MILESTONES;

function item(id: string, label: string, milestone?: string, run?: () => void): MenuEntry {
  return { type: "item", id, label, milestone, run };
}

function separator(id: string): MenuEntry {
  return { type: "separator", id };
}

/** Entries for one reference on the commit. */
function refEntries(ref: RefLabel, actions: CommitMenuActions): MenuEntry[] {
  const copyName = item("copy-name", "Copy name", undefined, () => {
    actions.copy(ref.name, "Name");
  });
  const compare = item("compare", "Compare with the current branch", undefined, () => {
    actions.compareWithCurrent(refRevision(ref));
  });
  switch (ref.kind) {
    case "branch":
      return [
        ...(ref.isHead
          ? []
          : [
              item("checkout", "Check out", branches),
              item("merge", "Merge into the current branch…", history),
              item("rebase", "Rebase the current branch onto it…", history),
              compare,
              separator("sep-ref"),
            ]),
        item("rename", "Rename…", branches),
        item("delete", "Delete…", branches),
        item("push", "Push", branches),
        separator("sep-copy"),
        copyName,
      ];
    case "remote":
      return [
        item("checkout", "Check out as a new local branch…", branches),
        item("merge", "Merge into the current branch…", history),
        item("rebase", "Rebase the current branch onto it…", history),
        compare,
        item("delete", "Delete on the remote…", branches),
        separator("sep-copy"),
        copyName,
      ];
    case "tag":
      return [
        compare,
        item("push", "Push", branches),
        item("delete", "Delete…", branches),
        separator("sep-copy"),
        copyName,
      ];
    case "head":
      return [];
  }
}

const REF_KIND_WORDS: Record<RefLabel["kind"], string> = {
  branch: "Branch",
  remote: "Remote branch",
  tag: "Tag",
  head: "HEAD",
};

/** The menu for `commit`. */
export function commitMenu(commit: CommitRowDto, actions: CommitMenuActions): MenuEntry[] {
  const { copy } = actions;
  const refs = commit.refs.filter((ref) => ref.kind !== "head");
  const entries: MenuEntry[] = [
    {
      type: "submenu",
      id: "copy",
      label: "Copy",
      entries: [
        item("copy-id", "Commit id", undefined, () => {
          copy(commit.id, "Commit id");
        }),
        item("copy-short-id", "Short commit id", undefined, () => {
          copy(commit.id.slice(0, 8), "Short commit id");
        }),
        item("copy-subject", "Subject", undefined, () => {
          copy(commit.summary, "Subject");
        }),
        item("copy-message", "Whole message", undefined, actions.copyMessage),
      ],
    },
  ];
  if (actions.highlighted !== undefined) {
    entries.push(
      item(
        "highlight",
        actions.highlighted ? "Clear the highlight" : "Highlight its history",
        undefined,
        actions.toggleHighlight,
      ),
    );
  }
  entries.push(
    separator("sep-inspect"),
    item("compare-head", "Compare with HEAD", undefined, actions.compareWithHead),
    item("compare-worktree", "Compare with the working tree", workingTree),
    item("browse", "Browse files at this commit", undefined, actions.browseFiles),
    separator("sep-branches"),
    item("checkout", "Check out this commit…", branches),
    item("create-branch", "Create a branch here…", branches),
    item("create-tag", "Create a tag here…", branches),
    separator("sep-history"),
    item("merge", "Merge into the current branch…", history),
    item("rebase", "Rebase the current branch onto this…", history),
    item("rebase-interactive", "Interactive rebase from here…", history),
    item("cherry-pick", "Cherry-pick", history),
    item("revert", "Revert", history),
    item("reset", "Reset the current branch to here…", history),
  );
  if (refs.length > 0) {
    entries.push(separator("sep-refs"));
    for (const ref of refs) {
      entries.push({
        type: "submenu",
        id: `ref:${ref.kind}:${ref.name}`,
        label: `${REF_KIND_WORDS[ref.kind]} ${ref.name}`,
        entries: refEntries(ref, actions),
      });
    }
  }
  entries.push(separator("sep-advanced"), {
    type: "submenu",
    id: "advanced",
    label: "More",
    entries: [
      item("bisect-good", "Bisect: mark as good", advanced),
      item("bisect-bad", "Bisect: mark as bad", advanced),
      item("patch", "Create a patch…", advanced),
      item("archive", "Save an archive…", advanced),
      item("scripts", "Run a script…", advanced),
    ],
  });
  return entries;
}

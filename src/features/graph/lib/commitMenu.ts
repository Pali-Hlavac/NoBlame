/**
 * The entries of the context menu on a commit (owner request 2026-10-30; the full list is in
 * docs/roadmap.md, "Commit context menu"). Entries whose operation arrives later name the
 * milestone that delivers it and are shown disabled, like the toolbar.
 */
import type { CommitRowDto, RefLabel } from "@/shared/ipc/bindings";

import { shortId } from "./format";
import { MENU_MILESTONES, item, refItem, separator, type MenuEntry } from "./menuEntry";
import { refEntries, type RefMenuActions } from "./refMenu";

export { MENU_MILESTONES, type MenuEntry };

/** What the working entries do; the menu itself stays free of side effects. */
export interface CommitMenuActions extends RefMenuActions {
  /** Copies the whole message (read from the backend). */
  copyMessage: () => void;
  /** Whether the commit's history is highlighted now; `undefined` when highlighting is off. */
  highlighted: boolean | undefined;
  toggleHighlight: () => void;
  /** Shows the commit's files (the Files module). */
  browseFiles: () => void;
  /** Compares the commit with HEAD; `undefined` when it is HEAD. */
  compareWithHead: (() => void) | undefined;
  /** Compares the commit with the working tree; `undefined` in a bare repository. */
  compareWithWorkingTree: (() => void) | undefined;
}

const { history, advanced } = MENU_MILESTONES;

const REF_KIND_WORDS: Record<RefLabel["kind"], string> = {
  branch: "Branch",
  remote: "Remote branch",
  tag: "Tag",
  head: "HEAD",
};

/** The menu for `commit`. */
export function commitMenu(commit: CommitRowDto, actions: CommitMenuActions): MenuEntry[] {
  const { copy, refs: refActions } = actions;
  const here = { revision: commit.id, label: `${shortId(commit.id)} ${commit.summary}` };
  const picked = { ...here, parentCount: commit.parentCount };
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
    ...(actions.compareWithWorkingTree
      ? [
          item(
            "compare-worktree",
            "Compare with the working tree",
            undefined,
            actions.compareWithWorkingTree,
          ),
        ]
      : []),
    item("browse", "Browse files at this commit", undefined, actions.browseFiles),
    separator("sep-branches"),
    refItem(
      "checkout",
      "Check out this commit…",
      refActions &&
        (() => {
          refActions.checkoutCommit(here);
        }),
    ),
    refItem(
      "create-branch",
      "Create a branch here…",
      refActions &&
        (() => {
          refActions.createBranch(here);
        }),
    ),
    refItem(
      "create-tag",
      "Create a tag here…",
      refActions &&
        (() => {
          refActions.createTag(here);
        }),
    ),
    separator("sep-history"),
    refItem(
      "merge",
      "Merge into the current branch…",
      refActions &&
        (() => {
          refActions.merge(here);
        }),
    ),
    refItem(
      "rebase",
      "Rebase the current branch onto this…",
      refActions &&
        (() => {
          refActions.rebase(here);
        }),
    ),
    item("rebase-interactive", "Interactive rebase from here…", history),
    refItem(
      "cherry-pick",
      "Cherry-pick…",
      refActions &&
        (() => {
          refActions.cherryPick(picked);
        }),
    ),
    refItem(
      "revert",
      "Revert…",
      refActions &&
        (() => {
          refActions.revert(picked);
        }),
    ),
    refItem(
      "reset",
      "Reset the current branch to here…",
      refActions &&
        (() => {
          refActions.reset(here);
        }),
    ),
  );
  if (refs.length > 0) {
    entries.push(separator("sep-refs"));
    for (const ref of refs) {
      entries.push({
        type: "submenu",
        id: `ref:${ref.kind}:${ref.name}`,
        label: `${REF_KIND_WORDS[ref.kind]} ${ref.name}`,
        entries: refEntries(ref, commit, actions),
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

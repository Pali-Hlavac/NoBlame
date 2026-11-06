/** The submenu of one branch, remote branch or tag on a commit, in the commit's context menu. */
import type { CommitRowDto, RefLabel, RefTargetDto } from "@/shared/ipc/bindings";

import { MENU_MILESTONES, item, refItem, separator, type MenuEntry } from "./menuEntry";
import type { RefActions } from "./refActions";
import { refRevision } from "./revision";

const { history } = MENU_MILESTONES;

/** What a reference's entries do. */
export interface RefMenuActions {
  copy: (text: string, what: string) => void;
  /** Compares the current branch with a reference (its full name) on the commit. */
  compareWithCurrent: (revision: string) => void;
  /** Branch and tag actions; their entries are labelled stubs without them. */
  refs?: RefActions;
}

/** The actions that take the reference itself. */
type TargetAction = "renameBranch" | "deleteRef" | "checkoutRemote" | "deleteOnRemote";

/** Entries for the reference `ref` on `commit`. */
export function refEntries(
  ref: RefLabel,
  commit: CommitRowDto,
  actions: RefMenuActions,
): MenuEntry[] {
  const { refs } = actions;
  if (ref.kind === "head") return [];
  const target: RefTargetDto = { namespace: ref.kind, name: ref.name, target: commit.id };
  const act = (action: TargetAction) =>
    refs &&
    (() => {
      refs[action](target);
    });
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
              refItem(
                "checkout",
                "Check out",
                refs &&
                  (() => {
                    refs.checkoutBranch(ref.name);
                  }),
              ),
              item("merge", "Merge into the current branch…", history),
              item("rebase", "Rebase the current branch onto it…", history),
              compare,
              separator("sep-ref"),
            ]),
        refItem("rename", "Rename…", act("renameBranch")),
        // git never deletes the branch that is checked out.
        ...(ref.isHead ? [] : [refItem("delete", "Delete…", act("deleteRef"))]),
        refItem(
          "push",
          "Push…",
          refs &&
            (() => {
              refs.pushBranch(ref.name);
            }),
        ),
        separator("sep-copy"),
        copyName,
      ];
    case "remote":
      return [
        refItem("checkout", "Check out as a new local branch…", act("checkoutRemote")),
        item("merge", "Merge into the current branch…", history),
        item("rebase", "Rebase the current branch onto it…", history),
        compare,
        refItem("delete", "Delete on the remote…", act("deleteOnRemote")),
        separator("sep-copy"),
        copyName,
      ];
    case "tag":
      return [
        compare,
        refItem(
          "push",
          "Push…",
          refs &&
            (() => {
              refs.pushTag(ref.name);
            }),
        ),
        refItem("delete", "Delete…", act("deleteRef")),
        refItem("delete-remote", "Delete on a remote…", act("deleteOnRemote")),
        separator("sep-copy"),
        copyName,
      ];
  }
}

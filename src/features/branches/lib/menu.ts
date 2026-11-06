/** The entries of the Branches module's context menu for one branch, remote branch or tag. */
import type { RefActions, StartPoint } from "@/features/graph";
import type { RefEntry, RefTargetDto } from "@/shared/ipc/bindings";

export type BranchMenuEntry =
  { type: "item"; id: string; label: string; run: () => void } | { type: "separator"; id: string };

/** Upstream entries of a local branch's menu. */
export interface UpstreamMenuActions {
  /** The branch has an upstream (so it can be removed). */
  has: boolean;
  set: () => void;
  unset: () => void;
}

const PREFIX = { branch: "refs/heads/", remote: "refs/remotes/", tag: "refs/tags/" } as const;

/** The reference as the actions take it; `null` for a detached HEAD. */
export function targetOf(entry: RefEntry): RefTargetDto | null {
  const { kind, name } = entry.label;
  return kind === "head" ? null : { namespace: kind, name, target: entry.target };
}

/** Where a branch or tag made from `entry` starts: its full name, so it is never ambiguous. */
function startOf(target: RefTargetDto): StartPoint {
  return { revision: `${PREFIX[target.namespace]}${target.name}`, label: target.name };
}

/** The entries for `entry`; `copy` copies its name. Local branches get `upstream`'s entries. */
export function branchMenu(
  entry: RefEntry,
  actions: RefActions,
  copy: (name: string) => void,
  upstream?: UpstreamMenuActions,
): BranchMenuEntry[] {
  const target = targetOf(entry);
  if (!target) return [];
  const item = (id: string, label: string, run: () => void): BranchMenuEntry => ({
    type: "item",
    id,
    label,
    run,
  });
  const start = startOf(target);
  const createBranch = item("create-branch", "Create a branch here…", () => {
    actions.createBranch(start);
  });
  const create = [
    createBranch,
    item("create-tag", "Create a tag here…", () => {
      actions.createTag(start);
    }),
  ];
  const tail = [
    { type: "separator", id: "sep-copy" } as const,
    item("copy-name", "Copy name", () => {
      copy(target.name);
    }),
  ];
  switch (target.namespace) {
    case "branch":
      return [
        ...(entry.label.isHead
          ? []
          : [
              item("checkout", "Check out", () => {
                actions.checkoutBranch(target.name);
              }),
            ]),
        ...create,
        { type: "separator", id: "sep-change" },
        item("rename", "Rename…", () => {
          actions.renameBranch(target);
        }),
        // git never deletes the branch that is checked out.
        ...(entry.label.isHead
          ? []
          : [
              item("delete", "Delete…", () => {
                actions.deleteRef(target);
              }),
            ]),
        ...(upstream
          ? [
              { type: "separator", id: "sep-upstream" } as const,
              item(
                "set-upstream",
                upstream.has ? "Change upstream…" : "Set upstream…",
                upstream.set,
              ),
              ...(upstream.has ? [item("unset-upstream", "Remove upstream", upstream.unset)] : []),
            ]
          : []),
        ...tail,
      ];
    case "remote":
      return [
        item("checkout", "Check out as a new local branch…", () => {
          actions.checkoutRemote(target);
        }),
        ...create,
        ...tail,
      ];
    case "tag":
      return [
        createBranch,
        { type: "separator", id: "sep-change" },
        item("delete", "Delete…", () => {
          actions.deleteRef(target);
        }),
        ...tail,
      ];
  }
}

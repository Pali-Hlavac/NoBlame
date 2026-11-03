/**
 * Kinds of work, each with one icon colour used everywhere: the activity bar, the toolbar, the
 * command palette, menus and the Repositories module, so a colour always means the same thing.
 * The colours are theme tokens (`--kind-*` in `src/app/styles.css`, light and dark); change
 * them there.
 */

/** What a module, button, command or row is about. */
export type WorkKind =
  "commit" | "stash" | "history" | "branches" | "repositories" | "groups" | "submodules";

/** Icon class of each kind. Things without a kind (app settings, About) keep the text colour. */
export const KIND_ICON_CLASSES: Readonly<Record<WorkKind, string>> = {
  commit: "text-kind-commit",
  stash: "text-kind-stash",
  history: "text-kind-history",
  branches: "text-kind-branches",
  repositories: "text-kind-repositories",
  groups: "text-kind-groups",
  submodules: "text-kind-submodules",
};

/** The icon class for `kind`, or none. */
export function kindIconClass(kind: WorkKind | undefined): string | undefined {
  return kind && KIND_ICON_CLASSES[kind];
}

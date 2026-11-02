/**
 * Which tab gets the focus when the focused tab closes. Activating a tab that sits hidden behind
 * another one would switch what its group shows (closing the diff in the right half of a split
 * would replace the graph in the left half), so only tabs already on screen are chosen.
 */

/** The part of a dockview group that choosing needs. */
export interface GroupLike {
  panels: readonly { id: string }[];
  activePanel: { id: string } | undefined;
}

/** The part of the dockview API that choosing needs. */
export interface ChooserDockLike {
  activePanel: { id: string } | undefined;
  groups: readonly GroupLike[];
}

/**
 * The tab to focus after `closedId` closes: what the dock focused instead, else the closed tab's
 * neighbour in its group (the dock shows it next), else the active repository's tab if it is on
 * screen, else any tab on screen.
 */
export function nextActiveAfterClose(
  dock: ChooserDockLike,
  closedId: string,
  activeRepositoryTabId: string | null,
): string | null {
  const focused = dock.activePanel?.id;
  if (focused && focused !== closedId) return focused;
  const home = dock.groups.find((group) => group.panels.some((panel) => panel.id === closedId));
  if (home) {
    const index = home.panels.findIndex((panel) => panel.id === closedId);
    const neighbour = home.panels[index + 1] ?? home.panels[index - 1];
    if (neighbour) return neighbour.id;
  }
  const shown = dock.groups
    .map((group) => group.activePanel?.id)
    .filter((id): id is string => id !== undefined && id !== closedId);
  if (activeRepositoryTabId && shown.includes(activeRepositoryTabId)) return activeRepositoryTabId;
  return shown[0] ?? null;
}

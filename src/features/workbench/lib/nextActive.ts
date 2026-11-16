/**
 * Which tab gets the focus when the focused tab closes: the one used last, as in an editor.
 * Activating a tab that sits hidden behind another one would switch what its group shows
 * (closing the diff in the right half of a split would replace the graph in the left half), so
 * only the closed tab's own group and the tabs already on screen are chosen from.
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

/** The id in `ids` used most recently (`recent`: most recent first), or undefined. */
function usedLast(ids: readonly string[], recent: readonly string[]): string | undefined {
  return recent.find((id) => ids.includes(id));
}

/**
 * The tab to focus after `closedId` closes. `recent` lists tab ids, the most recently used first;
 * it is kept by the tabs store, so moving tabs between groups does not forget it. `home` is the
 * group the tab was in, when the dock has already taken it out.
 *
 * In the closed tab's group: the tab used last there (the dock's neighbour when none was used);
 * a group left empty gives way to the tab on screen used last, else any tab on screen.
 */
export function nextActiveAfterClose(
  dock: ChooserDockLike,
  closedId: string,
  recent: readonly string[],
  home?: GroupLike,
): string | null {
  const group =
    home ?? dock.groups.find((candidate) => candidate.panels.some((p) => p.id === closedId));
  if (group) {
    const ids = group.panels.map((panel) => panel.id);
    const others = ids.filter((id) => id !== closedId);
    const last = usedLast(others, recent);
    if (last) return last;
    const index = ids.indexOf(closedId);
    const neighbour = index === -1 ? others[0] : (ids[index + 1] ?? ids[index - 1]);
    if (neighbour) return neighbour;
  }
  const shown = dock.groups
    .map((candidate) => candidate.activePanel?.id)
    .filter((id): id is string => id !== undefined && id !== closedId);
  return usedLast(shown, recent) ?? shown[0] ?? null;
}

/**
 * Edits of the repository groups (folders of repositories, like bookmarks). Each function returns
 * a new list and leaves its input alone, so they can run on the query cache optimistically.
 */
import type { RepositoryGroup } from "@/shared/ipc/bindings";

import { repositoryTab } from "./path";

/** Name of a new group; a number is added when it is taken ("New group 2"). */
export const NEW_GROUP_NAME = "New group";

/** Paths name the same repository when their tabs would be the same. */
const sameRepository = (a: string, b: string): boolean =>
  repositoryTab(a).id === repositoryTab(b).id;

/** Whether `group` holds `path`. */
export function groupHas(group: RepositoryGroup, path: string): boolean {
  return group.repositories.some((held) => sameRepository(held, path));
}

/** A name for a new group that no group has yet. */
export function freeGroupName(groups: readonly RepositoryGroup[]): string {
  const taken = new Set(groups.map((group) => group.name));
  if (!taken.has(NEW_GROUP_NAME)) return NEW_GROUP_NAME;
  let number = 2;
  while (taken.has(`${NEW_GROUP_NAME} ${number}`)) number += 1;
  return `${NEW_GROUP_NAME} ${number}`;
}

/** Appends an empty, expanded group holding `paths`. */
export function addGroup(
  groups: readonly RepositoryGroup[],
  id: string,
  name: string,
  paths: readonly string[] = [],
): RepositoryGroup[] {
  return [...groups, { id, name, collapsed: false, repositories: [...paths] }];
}

function update(
  groups: readonly RepositoryGroup[],
  id: string,
  change: (group: RepositoryGroup) => RepositoryGroup,
): RepositoryGroup[] {
  return groups.map((group) => (group.id === id ? change(group) : group));
}

export function renameGroup(
  groups: readonly RepositoryGroup[],
  id: string,
  name: string,
): RepositoryGroup[] {
  return update(groups, id, (group) => ({ ...group, name }));
}

export function setCollapsed(
  groups: readonly RepositoryGroup[],
  id: string,
  collapsed: boolean,
): RepositoryGroup[] {
  return update(groups, id, (group) => ({ ...group, collapsed }));
}

export function removeGroup(groups: readonly RepositoryGroup[], id: string): RepositoryGroup[] {
  return groups.filter((group) => group.id !== id);
}

/** Moves the group to `index` of the resulting list (clamped). */
export function moveGroup(
  groups: readonly RepositoryGroup[],
  id: string,
  index: number,
): RepositoryGroup[] {
  const moved = groups.find((group) => group.id === id);
  if (!moved) return [...groups];
  const rest = groups.filter((group) => group !== moved);
  rest.splice(clamp(index, rest.length), 0, moved);
  return rest;
}

/**
 * Puts `path` into group `toId` at `index` (the end when omitted), taking it out of `fromId`
 * first when it is moved from another group, or from another place in the same group.
 */
export function placeRepository(
  groups: readonly RepositoryGroup[],
  path: string,
  toId: string,
  index?: number,
  fromId?: string,
): RepositoryGroup[] {
  const taken = fromId === undefined ? groups : removeRepository(groups, fromId, path);
  return update(taken, toId, (group) => {
    const rest = group.repositories.filter((held) => !sameRepository(held, path));
    rest.splice(clamp(index ?? rest.length, rest.length), 0, path);
    return { ...group, repositories: rest };
  });
}

export function removeRepository(
  groups: readonly RepositoryGroup[],
  id: string,
  path: string,
): RepositoryGroup[] {
  return update(groups, id, (group) => ({
    ...group,
    repositories: group.repositories.filter((held) => !sameRepository(held, path)),
  }));
}

/**
 * Where a repository dropped on `target`'s row lands in `group`: before that row, or after it
 * when dropped on its lower half. Counted without the dragged repository (see
 * {@link placeRepository}).
 */
export function repositoryDropIndex(
  group: RepositoryGroup,
  target: string,
  dragged: string,
  after: boolean,
): number {
  const rest = group.repositories.filter((held) => !sameRepository(held, dragged));
  const at = rest.findIndex((held) => sameRepository(held, target));
  return at === -1 ? rest.length : at + (after ? 1 : 0);
}

/** Where a group dropped on `targetId`'s row lands (see {@link moveGroup}). */
export function groupDropIndex(
  groups: readonly RepositoryGroup[],
  targetId: string,
  draggedId: string,
  after: boolean,
): number {
  const rest = groups.filter((group) => group.id !== draggedId);
  const at = rest.findIndex((group) => group.id === targetId);
  return at === -1 ? rest.length : at + (after ? 1 : 0);
}

function clamp(index: number, length: number): number {
  return Math.min(Math.max(index, 0), length);
}

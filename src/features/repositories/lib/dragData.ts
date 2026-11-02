/**
 * Drag and drop in the Repositories module: repositories (open, recent or grouped) dragged onto
 * groups, and groups and the module's sections dragged to reorder them. Custom types keep other drops (dock tabs, files)
 * out; while dragging, only the types can be read, the data only on drop.
 */
import type { DragEvent } from "react";

import type { RepositoriesSection } from "@/shared/ipc/bindings";

import { ALL_SECTIONS } from "./sections";

const REPOSITORY_TYPE = "application/x-noblame-repository";
const GROUP_TYPE = "application/x-noblame-group";

/** A dragged repository, and the group it is dragged out of (if any). */
export interface DraggedRepository {
  path: string;
  fromGroup?: string;
}

export function startRepositoryDrag(event: DragEvent, dragged: DraggedRepository): void {
  event.dataTransfer.setData(REPOSITORY_TYPE, JSON.stringify(dragged));
  event.dataTransfer.setData("text/plain", dragged.path);
  event.dataTransfer.effectAllowed = "copyMove";
}

export function startGroupDrag(event: DragEvent, groupId: string): void {
  event.dataTransfer.setData(GROUP_TYPE, groupId);
  event.dataTransfer.effectAllowed = "move";
}

export const isRepositoryDrag = (event: DragEvent): boolean =>
  event.dataTransfer.types.includes(REPOSITORY_TYPE);

export const isGroupDrag = (event: DragEvent): boolean =>
  event.dataTransfer.types.includes(GROUP_TYPE);

/** The dropped repository, if the drop carries one. */
export function droppedRepository(event: DragEvent): DraggedRepository | undefined {
  const raw = event.dataTransfer.getData(REPOSITORY_TYPE);
  if (!raw) return undefined;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value === "object" && value !== null && "path" in value) {
      const { path, fromGroup } = value as { path: unknown; fromGroup?: unknown };
      if (typeof path !== "string") return undefined;
      return typeof fromGroup === "string" ? { path, fromGroup } : { path };
    }
  } catch {
    // Not ours.
  }
  return undefined;
}

const SECTION_TYPE = "application/x-noblame-section";

export function startSectionDrag(event: DragEvent, section: RepositoriesSection): void {
  event.dataTransfer.setData(SECTION_TYPE, section);
  event.dataTransfer.effectAllowed = "move";
}

export const isSectionDrag = (event: DragEvent): boolean =>
  event.dataTransfer.types.includes(SECTION_TYPE);

/** The dropped section, if the drop carries one. */
export function droppedSection(event: DragEvent): RepositoriesSection | undefined {
  const value = event.dataTransfer.getData(SECTION_TYPE);
  return ALL_SECTIONS.find((section) => section === value);
}

/** Whether the drop is on the lower half of the row it lands on (then it goes after it). */
export function onLowerHalf(event: DragEvent): boolean {
  const rect = event.currentTarget.getBoundingClientRect();
  return event.clientY > rect.top + rect.height / 2;
}

/** The dropped group's id, if the drop carries one. */
export function droppedGroup(event: DragEvent): string | undefined {
  return event.dataTransfer.getData(GROUP_TYPE) || undefined;
}

/** Order of the Repositories module's sections (Open, Groups, Recent), as saved in Settings. */
import type { RepositoriesSection } from "@/shared/ipc/bindings";

export const ALL_SECTIONS: readonly RepositoriesSection[] = ["open", "groups", "recent"];

/** The saved order without repeats or unknown names, with missing sections added at the end. */
export function sectionOrder(saved: readonly RepositoriesSection[]): RepositoriesSection[] {
  const order = saved.filter(
    (section, index) => ALL_SECTIONS.includes(section) && saved.indexOf(section) === index,
  );
  return [...order, ...ALL_SECTIONS.filter((section) => !order.includes(section))];
}

/** `order` with `moved` placed at `index` of the result (clamped). */
export function moveSection(
  order: readonly RepositoriesSection[],
  moved: RepositoriesSection,
  index: number,
): RepositoriesSection[] {
  const rest = order.filter((section) => section !== moved);
  rest.splice(Math.min(Math.max(index, 0), rest.length), 0, moved);
  return rest;
}

/** Where a section dropped on `target`'s header lands: before it, or after on its lower half. */
export function sectionDropIndex(
  order: readonly RepositoriesSection[],
  target: RepositoriesSection,
  moved: RepositoriesSection,
  after: boolean,
): number {
  const rest = order.filter((section) => section !== moved);
  const at = rest.indexOf(target);
  return at === -1 ? rest.length : at + (after ? 1 : 0);
}

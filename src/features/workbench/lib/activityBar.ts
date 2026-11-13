/**
 * The activity bar's arrangement (owner request 2026-11-13): the order of its icons, the ones
 * hidden under "…", and whether dragging is locked. Stacked modules form one unit: framed
 * together, at the place of the stack's first module, moved and hidden together.
 */
import type { WorkbenchModule } from "../types";
import type { ModuleStack } from "./stacks";

export interface ActivityBarLayout {
  /** Module ids in bar order; modules missing from it follow in the registry's order. */
  order: string[];
  /** Module ids hidden under "…". */
  hidden: string[];
  /** Icons cannot be dragged. */
  locked: boolean;
}

export const DEFAULT_ACTIVITY_BAR: ActivityBarLayout = { order: [], hidden: [], locked: false };

/** An icon of the bar, or the framed icons of a stack. */
export interface BarUnit {
  /** Its first module's id. */
  id: string;
  modules: WorkbenchModule[];
}

/** Every module id in bar order: the saved order of known modules, then new modules. */
export function fullOrder(modules: readonly WorkbenchModule[], order: readonly string[]): string[] {
  const known = new Set(modules.map((module) => module.id));
  const kept = order.filter((id, index) => known.has(id) && order.indexOf(id) === index);
  const missing = modules.map((module) => module.id).filter((id) => !kept.includes(id));
  return [...kept, ...missing];
}

/** The bar's units in order; a stack sits where its first module (in bar order) is. */
export function barUnits(
  modules: readonly WorkbenchModule[],
  order: readonly string[],
  stacks: readonly ModuleStack[],
): BarUnit[] {
  const byId = new Map(modules.map((module) => [module.id, module]));
  const placed = new Set<string>();
  const units: BarUnit[] = [];
  for (const id of fullOrder(modules, order)) {
    if (placed.has(id)) continue;
    const ids = stacks.find((stack) => stack.modules.includes(id))?.modules ?? [id];
    const members = ids.flatMap((member) => byId.get(member) ?? []);
    members.forEach((member) => placed.add(member.id));
    const [first] = members;
    if (first) units.push({ id: first.id, modules: members });
  }
  return units;
}

/** A unit is hidden when its first module is. */
export function isHidden(unit: BarUnit, hidden: readonly string[]): boolean {
  return hidden.includes(unit.id);
}

/** The order with `moved` placed together before `target`'s first id, or after its last. */
export function moveIds(
  order: readonly string[],
  moved: readonly string[],
  target: readonly string[],
  after: boolean,
): string[] {
  const rest = order.filter((id) => !moved.includes(id));
  const anchor = after ? target[target.length - 1] : target[0];
  const at = anchor === undefined ? -1 : rest.indexOf(anchor);
  if (at < 0) return [...rest, ...moved];
  const index = after ? at + 1 : at;
  return [...rest.slice(0, index), ...moved, ...rest.slice(index)];
}

/** The order with a new stack's modules together, where its first module was. */
export function gatherStack(order: readonly string[], stack: readonly string[]): string[] {
  const [first, ...others] = stack;
  if (first === undefined) return [...order];
  return moveIds(order, others, [first], true);
}

/** The order with `unit` one place up (-1) or down (+1) among the shown units. */
export function stepUnit(
  units: readonly BarUnit[],
  order: readonly string[],
  unit: BarUnit,
  step: -1 | 1,
): string[] {
  const index = units.findIndex((other) => other.id === unit.id);
  const neighbour = units[index + step];
  if (index < 0 || !neighbour) return [...order];
  const ids = (target: BarUnit) => target.modules.map((module) => module.id);
  return moveIds(order, ids(unit), ids(neighbour), step === 1);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
}

/** The bar's arrangement read from a saved layout (defaults for anything missing). */
export function parseActivityBar(value: unknown): ActivityBarLayout {
  if (!isRecord(value)) return { ...DEFAULT_ACTIVITY_BAR };
  return {
    order: strings(value.order),
    hidden: strings(value.hidden),
    locked: value.locked === true,
  };
}

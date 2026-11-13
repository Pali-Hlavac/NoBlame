/**
 * Changes to the activity bar's arrangement from its menu, its "…" button and dragging: each
 * updates the store and saves the layout. A locked bar keeps its order and hidden icons.
 */
import { useWorkbenchStore } from "../store/workbench";
import { fullOrder, moveIds, stepUnit, type ActivityBarLayout, type BarUnit } from "./activityBar";
import { docks, scheduleLayoutSave } from "./docks";

function idsOf(unit: BarUnit): string[] {
  return unit.modules.map((module) => module.id);
}

function update(patch: Partial<ActivityBarLayout>): void {
  useWorkbenchStore.getState().setActivityBar(patch);
  scheduleLayoutSave();
}

function locked(): boolean {
  return useWorkbenchStore.getState().activityBar.locked;
}

function currentOrder(): string[] {
  return fullOrder(docks.registered, useWorkbenchStore.getState().activityBar.order);
}

/** Moves `unit` before `target`, or after it with `after` (a drop). */
export function dropUnit(unit: BarUnit, target: BarUnit, after: boolean): void {
  if (locked() || unit.id === target.id) return;
  update({ order: moveIds(currentOrder(), idsOf(unit), idsOf(target), after) });
}

/** Moves `unit` one place up (-1) or down (+1) among `units` (the shown ones). */
export function stepBarUnit(units: readonly BarUnit[], unit: BarUnit, step: -1 | 1): void {
  if (locked()) return;
  update({ order: stepUnit(units, currentOrder(), unit, step) });
}

/** Hides `unit` under "…". */
export function hideUnit(unit: BarUnit): void {
  if (locked()) return;
  const { hidden } = useWorkbenchStore.getState().activityBar;
  update({ hidden: [...hidden.filter((id) => id !== unit.id), unit.id] });
}

/** Shows `unit` in the bar again, or every hidden one without it. */
export function showUnit(unit?: BarUnit): void {
  if (locked()) return;
  const { hidden } = useWorkbenchStore.getState().activityBar;
  update({ hidden: unit ? hidden.filter((id) => id !== unit.id) : [] });
}

export function setBarLocked(value: boolean): void {
  update({ locked: value });
}

/** Back to the registry's order. */
export function resetBarOrder(): void {
  if (locked()) return;
  update({ order: [] });
}

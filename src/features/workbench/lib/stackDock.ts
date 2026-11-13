/**
 * Module stacks in the module dock: making, changing and ending stacks, keeping the dock's
 * panels in step with them (a stacked module shows in its stack's panel, never on its own), and
 * saving how a stack's height is shared.
 */
import type { DockviewApi } from "dockview-react";

import { useWorkbenchStore } from "../store/workbench";
import { fullOrder, gatherStack } from "./activityBar";
import { addModulePanel, docks, scheduleLayoutSave } from "./docks";
import {
  idsOfStackPanel,
  isStackPanelId,
  joinStacks,
  panelIdOf,
  stackPanelId,
  withoutModule,
  withoutStack,
  type ModuleStack,
} from "./stacks";

/**
 * Brings the dock in step with the stacks: a module open on its own that is now stacked moves
 * into its stack's panel, and the panel of a stack that changed or ended gives way to its
 * modules' panels, in the same group. Modules the app no longer has are left out.
 */
export function syncStacks(api: DockviewApi): void {
  const { stacks } = useWorkbenchStore.getState();
  for (const panel of [...api.panels]) {
    const ids = isStackPanelId(panel.id) ? idsOfStackPanel(panel.id) : [panel.id];
    const wanted = [...new Set(ids.map((id) => panelIdOf(stacks, id)))];
    if (wanted.length === 1 && wanted[0] === panel.id) continue;
    const { group } = panel;
    const shown = group.activePanel?.id === panel.id;
    wanted.forEach((id, index) => {
      if (!api.getPanel(id)) addModulePanel(api, id, group, !shown || index > 0);
    });
    panel.api.close();
  }
}

/** Saves `stacks` and the bar order they need, then brings the dock in step. */
function applyStacks(stacks: ModuleStack[], order?: string[]): void {
  const store = useWorkbenchStore.getState();
  store.setStacks(stacks);
  if (order) store.setActivityBar({ order });
  if (docks.modules) syncStacks(docks.modules);
  scheduleLayoutSave();
}

/** Shows `added` below `target` (and the rest of its stack) in one tab, and opens that tab. */
export function stackModules(target: string, added: string): void {
  const store = useWorkbenchStore.getState();
  const { stacks, stack } = joinStacks(store.stacks, target, added);
  const order = gatherStack(fullOrder(docks.registered, store.activityBar.order), stack.modules);
  store.setActivityBar({ hidden: store.activityBar.hidden.filter((id) => id !== added) });
  applyStacks(stacks, order);
  const api = docks.modules;
  const id = stackPanelId(stack.modules);
  if (!api) return;
  store.setSidebarCollapsed(false);
  const panel = api.getPanel(id);
  if (panel) panel.api.setActive();
  else addModulePanel(api, id, undefined);
}

/** Ends the stack holding `moduleId`: each of its modules gets its own tab again. */
export function unstack(moduleId: string): void {
  applyStacks(withoutStack(useWorkbenchStore.getState().stacks, moduleId));
}

/** Takes `moduleId` out of its stack into a tab of its own (a stack left with one ends). */
export function takeOutOfStack(moduleId: string): void {
  applyStacks(withoutModule(useWorkbenchStore.getState().stacks, moduleId));
}

/** Remembers how the stack showing `modules` shares its height (percent per module). */
export function saveStackSizes(modules: readonly string[], sizes: number[]): void {
  const store = useWorkbenchStore.getState();
  const key = stackPanelId(modules);
  store.setStacks(
    store.stacks.map((stack) =>
      stackPanelId(stack.modules) === key ? { ...stack, sizes } : stack,
    ),
  );
  scheduleLayoutSave();
}

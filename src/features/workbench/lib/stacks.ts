/**
 * Module stacks (owner request 2026-11-13): modules shown together in one module dock tab, one
 * above the other, and framed together in the activity bar. A stack is a list of module ids, top
 * to bottom; its dock panel's id is made of them (`stack:commit-details+changed-files`). A module
 * is in at most one stack.
 */

export interface ModuleStack {
  /** Module ids, top to bottom (two or more). */
  modules: string[];
  /** Each module's share of the height, in percent; `null` for equal shares. */
  sizes: number[] | null;
}

const STACK_PREFIX = "stack:";
const STACK_JOIN = "+";

/** The dock panel id of a stack of `modules`. */
export function stackPanelId(modules: readonly string[]): string {
  return `${STACK_PREFIX}${modules.join(STACK_JOIN)}`;
}

/** The module ids a stack panel id names (also for a stack that has since changed). */
export function idsOfStackPanel(panelId: string): string[] {
  return panelId.slice(STACK_PREFIX.length).split(STACK_JOIN);
}

/** Whether a dock panel id is a stack's. */
export function isStackPanelId(id: string): boolean {
  return id.startsWith(STACK_PREFIX);
}

/** The stack `moduleId` is in, if any. */
export function stackOf(stacks: readonly ModuleStack[], moduleId: string): ModuleStack | undefined {
  return stacks.find((stack) => stack.modules.includes(moduleId));
}

/** The dock panel that shows `moduleId`: its stack's, or its own. */
export function panelIdOf(stacks: readonly ModuleStack[], moduleId: string): string {
  const stack = stackOf(stacks, moduleId);
  return stack ? stackPanelId(stack.modules) : moduleId;
}

/** The stack whose panel id is `panelId`, if it still exists. */
export function stackOfPanel(
  stacks: readonly ModuleStack[],
  panelId: string,
): ModuleStack | undefined {
  return stacks.find((stack) => stackPanelId(stack.modules) === panelId);
}

/** The modules a dock panel shows: a stack's, or the module itself. */
export function modulesOfPanel(stacks: readonly ModuleStack[], panelId: string): string[] {
  return isStackPanelId(panelId) ? (stackOfPanel(stacks, panelId)?.modules ?? []) : [panelId];
}

/**
 * `added` joined below `target` (and the rest of target's stack): the new stack, and the stacks
 * without the ones it replaces. `added` leaves any stack it was in.
 */
export function joinStacks(
  stacks: readonly ModuleStack[],
  target: string,
  added: string,
): { stacks: ModuleStack[]; stack: ModuleStack } {
  const rest = withoutModule(stacks, added);
  const old = stackOf(rest, target);
  const stack: ModuleStack = { modules: [...(old?.modules ?? [target]), added], sizes: null };
  return { stacks: [...rest.filter((other) => other !== old), stack], stack };
}

/** The stacks with `moduleId` taken out; a stack left with one module ends. */
export function withoutModule(stacks: readonly ModuleStack[], moduleId: string): ModuleStack[] {
  return stacks.flatMap((stack) => {
    if (!stack.modules.includes(moduleId)) return [stack];
    const modules = stack.modules.filter((id) => id !== moduleId);
    return modules.length > 1 ? [{ modules, sizes: null }] : [];
  });
}

/** The stacks with the one holding `moduleId` ended. */
export function withoutStack(stacks: readonly ModuleStack[], moduleId: string): ModuleStack[] {
  return stacks.filter((stack) => !stack.modules.includes(moduleId));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Stacks read from a saved layout: malformed entries, repeats and single modules are dropped. */
export function parseStacks(value: unknown): ModuleStack[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const stacks: ModuleStack[] = [];
  for (const entry of value) {
    if (!isRecord(entry) || !Array.isArray(entry.modules)) continue;
    const modules = entry.modules.filter(
      (id): id is string => typeof id === "string" && !seen.has(id),
    );
    if (modules.length < 2) continue;
    modules.forEach((id) => seen.add(id));
    const sizes =
      Array.isArray(entry.sizes) &&
      entry.sizes.length === modules.length &&
      entry.sizes.every((size) => typeof size === "number" && size > 0)
        ? (entry.sizes as number[])
        : null;
    stacks.push({ modules, sizes });
  }
  return stacks;
}

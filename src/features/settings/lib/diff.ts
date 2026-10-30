/** Choices of the diff tab's settings, shared by the Settings tab and the diff tab's toolbar. */
import type { DiffLayout, WhitespaceMode } from "@/shared/ipc/bindings";

/** Context that shows the whole file (the backend's `u32::MAX`). */
export const WHOLE_FILE_CONTEXT = 4_294_967_295;

export const DIFF_LAYOUT_OPTIONS: readonly { value: DiffLayout; label: string }[] = [
  { value: "unified", label: "Unified" },
  { value: "split", label: "Side by side" },
];

/** `short` is for the diff tab's toolbar, where space is tight. */
export const WHITESPACE_OPTIONS: readonly {
  value: WhitespaceMode;
  label: string;
  short: string;
}[] = [
  { value: "show", label: "Show all whitespace changes", short: "Show whitespace" },
  {
    value: "ignoreAtEol",
    label: "Ignore whitespace at line ends",
    short: "Ignore at line ends",
  },
  {
    value: "ignoreChange",
    label: "Ignore changes in the amount of whitespace",
    short: "Ignore amount",
  },
  { value: "ignoreAll", label: "Ignore all whitespace", short: "Ignore whitespace" },
];

/** Context lines the − and + buttons step through. */
export const CONTEXT_STEPS: readonly number[] = [
  0, 1, 2, 3, 4, 5, 6, 8, 10, 15, 20, 25, 30, 40, 50, 75, 100,
];

/** The next step above (`1`) or below (`-1`) `lines`; stays at the ends. */
export function stepContext(lines: number, direction: 1 | -1): number {
  if (direction === 1) {
    return CONTEXT_STEPS.find((step) => step > lines) ?? lines;
  }
  return CONTEXT_STEPS.findLast((step) => step < lines) ?? lines;
}

/** "3 lines", "1 line". */
export function contextLabel(lines: number): string {
  return lines === 1 ? "1 line" : `${lines} lines`;
}

/** The context to ask the backend for. */
export function requestedContext(settings: { contextLines: number; wholeFile: boolean }): number {
  return settings.wholeFile ? WHOLE_FILE_CONTEXT : settings.contextLines;
}

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

/** Context choices; `value` is a string so the same controls can show them. */
export const CONTEXT_OPTIONS: readonly {
  value: string;
  label: string;
  short: string;
  lines: number;
}[] = [
  { value: "3", label: "3 lines", short: "Context 3", lines: 3 },
  { value: "10", label: "10 lines", short: "Context 10", lines: 10 },
  { value: "25", label: "25 lines", short: "Context 25", lines: 25 },
  { value: "whole", label: "Whole file", short: "Whole file", lines: WHOLE_FILE_CONTEXT },
];

/** The choice for a number of context lines (a custom number shows as itself). */
export function contextValue(lines: number): string {
  return CONTEXT_OPTIONS.find((option) => option.lines === lines)?.value ?? String(lines);
}

/** The number of context lines of a choice. */
export function contextLines(value: string): number {
  return CONTEXT_OPTIONS.find((option) => option.value === value)?.lines ?? Number(value);
}

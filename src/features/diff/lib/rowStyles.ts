/** Colours and markers of diff rows, shared by the unified and side-by-side views. */
import type { DiffLineKindDto } from "@/shared/ipc/bindings";

/** Background (and text colour) of a row or cell. */
export const LINE_CLASSES: Readonly<Record<DiffLineKindDto, string>> = {
  hunk: "bg-diff-hunk text-muted-foreground",
  context: "",
  added: "bg-diff-added",
  removed: "bg-diff-removed",
  noNewline: "text-muted-foreground italic",
};

/** Line numbers stay put while the text scrolls sideways, so they need an opaque background. */
export const GUTTER_CLASSES: Readonly<Record<DiffLineKindDto, string>> = {
  hunk: "bg-diff-hunk",
  context: "bg-background",
  added: "bg-diff-added",
  removed: "bg-diff-removed",
  noNewline: "bg-background",
};

export const MARKERS: Readonly<Record<DiffLineKindDto, string>> = {
  hunk: "",
  context: "",
  added: "+",
  removed: "-",
  noNewline: "",
};

/** Read by screen readers instead of the + and - markers. */
export const SPOKEN: Readonly<Record<DiffLineKindDto, string>> = {
  hunk: "",
  context: "",
  added: "added: ",
  removed: "removed: ",
  noNewline: "",
};

/** Shown after a line cut by the backend. */
export const TRUNCATED_NOTE = "… line cut at 4,096 bytes";

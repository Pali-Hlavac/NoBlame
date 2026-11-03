import type { ReactNode } from "react";

import { cn } from "@/shared/lib/cn";

/** A changed line that can be chosen for staging: whether it is, and what a click does. */
export interface LineChoice {
  selected: boolean;
  /** `extend`: Shift was held (choose a range). */
  onClick: (extend: boolean) => void;
}

interface LineChoiceButtonProps {
  choice: LineChoice;
  /** "line 12", for the accessible name. */
  label: string;
  className: string;
  /** The line numbers. */
  children: ReactNode;
}

/**
 * The line numbers of a changed line in a working tree diff, as a button that chooses the line
 * (highlighted while chosen). Mouse only: hunks have keyboard-reachable buttons.
 */
export function LineChoiceButton({ choice, label, className, children }: LineChoiceButtonProps) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-pressed={choice.selected}
      aria-label={`Choose ${label}`}
      title="Choose this line (Shift+click: every changed line up to here)"
      className={cn(
        className,
        "cursor-pointer outline-none hover:bg-primary/15 focus-visible:ring-2 focus-visible:ring-ring",
        choice.selected && "bg-primary/30 text-foreground",
      )}
      // Shift+click would otherwise select text.
      onMouseDown={(event) => {
        event.preventDefault();
      }}
      onClick={(event) => {
        choice.onClick(event.shiftKey);
      }}
    >
      {children}
    </button>
  );
}

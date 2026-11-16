import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";

import { changeCommitLayout, useCommitLayout } from "../store/layout";

/**
 * The button that folds the message area to one line (the summary and the Commit button), so
 * the lists get the height; its state is remembered.
 */
export function MessageFold() {
  const folded = useCommitLayout((state) => state.folded);
  const Chevron = folded ? ChevronRightIcon : ChevronDownIcon;
  return (
    <button
      type="button"
      aria-expanded={!folded}
      aria-label={folded ? "Show the whole message" : "Fold the message to one line"}
      title={folded ? "Show the whole message" : "Fold the message to one line"}
      className="flex shrink-0 items-center gap-0.5 rounded-sm px-0.5 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      onClick={() => {
        changeCommitLayout({ folded: !folded });
      }}
    >
      <Chevron className="size-4" aria-hidden />
      Message
    </button>
  );
}

/** The folded message: its first line, or that there is none yet. */
export function FoldedSummary({ message }: { message: string }) {
  const summary = message.split("\n", 1)[0]?.trim() ?? "";
  return (
    <span
      className={
        summary
          ? "min-w-0 flex-1 truncate font-mono text-xs"
          : "min-w-0 flex-1 truncate text-xs text-muted-foreground italic"
      }
      title={summary || undefined}
    >
      {summary || "No message yet"}
    </span>
  );
}

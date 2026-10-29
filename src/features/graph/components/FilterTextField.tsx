import type { LucideIcon } from "lucide-react";
import { useEffect, useEffectEvent, useState } from "react";

import { cn } from "@/shared/lib/cn";

import { TEXT_FILTER_DELAY_MS } from "../lib/constants";

interface FilterTextFieldProps {
  /** Accessible name and placeholder. */
  label: string;
  icon: LucideIcon;
  /** The text the tab filters by now. */
  value: string | null;
  /** Applies new text (after a pause in typing, on Enter, or when cleared with Esc). */
  onCommit: (text: string | null) => void;
}

function normalized(text: string | null): string | null {
  const trimmed = (text ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

/** A search field of the filter bar. Typing applies the text after a short pause. */
export function FilterTextField({ label, icon: Icon, value, onCommit }: FilterTextFieldProps) {
  const [draft, setDraft] = useState(value ?? "");
  // The filter changed elsewhere (Clear, another field): show its text.
  const [shown, setShown] = useState(value);
  if (shown !== value) {
    setShown(value);
    setDraft(value ?? "");
  }
  const commit = (text: string) => {
    if (normalized(text) !== normalized(value)) onCommit(normalized(text));
  };
  const commitAfterPause = useEffectEvent(commit);
  useEffect(() => {
    const timer = setTimeout(() => {
      commitAfterPause(draft);
    }, TEXT_FILTER_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [draft]);

  return (
    <label
      className={cn(
        "flex h-6 max-w-44 min-w-16 flex-1 basis-32 items-center gap-1 rounded border border-border px-1.5 text-xs focus-within:ring-2 focus-within:ring-ring",
        normalized(value) !== null && "border-primary",
      )}
    >
      <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <input
        type="search"
        aria-label={label}
        placeholder={label}
        value={draft}
        className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit(draft);
          } else if (event.key === "Escape" && draft !== "") {
            event.preventDefault();
            setDraft("");
            commit("");
          }
        }}
      />
    </label>
  );
}

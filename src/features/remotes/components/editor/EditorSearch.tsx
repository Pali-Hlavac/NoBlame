import { SearchIcon, XIcon } from "lucide-react";
import { useRef } from "react";

import { formatHotkey } from "@/shared/lib/hotkeys";
import { useKeys } from "@/shared/hooks/useKeys";
import { isMacPlatform } from "@/shared/lib/platform";

import type { SearchResult } from "../../lib/settings/search";
import { useFindKey } from "./useEditorSearch";

interface EditorSearchProps {
  query: string;
  result: SearchResult | null;
  /** The match Enter moved to, or -1. */
  position: number;
  onChange: (query: string) => void;
  onStep: (delta: 1 | -1) => void;
}

/** The search box over every tab of the editor. */
export function EditorSearch({ query, result, position, onChange, onStep }: EditorSearchProps) {
  const input = useRef<HTMLInputElement>(null);
  useFindKey(input);
  const shortcut = formatHotkey(useKeys("history.find"), isMacPlatform());
  const count = result?.matches.length ?? 0;
  const status =
    result === null
      ? ""
      : count === 0
        ? "No setting matches."
        : position >= 0
          ? `${String(position + 1)} of ${String(count)}`
          : `${String(count)} match${count === 1 ? "" : "es"}: Enter goes to the next`;
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-1">
        <SearchIcon
          className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          ref={input}
          type="search"
          aria-label="Search the remote's settings"
          placeholder={`Search settings (${shortcut})`}
          value={query}
          spellCheck={false}
          className="h-8 w-full rounded-md border border-border bg-background pr-8 pl-8 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-search-cancel-button]:hidden"
          onChange={(event) => {
            onChange(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onStep(event.shiftKey ? -1 : 1);
            } else if (event.key === "Escape" && query) {
              // Clears the search instead of closing the dialog.
              event.stopPropagation();
              event.preventDefault();
              onChange("");
            }
          }}
        />
        {query ? (
          <button
            type="button"
            aria-label="Clear the search"
            className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            onClick={() => {
              onChange("");
            }}
          >
            <XIcon className="size-4" />
          </button>
        ) : null}
      </div>
      <p className="w-56 text-xs text-muted-foreground" aria-live="polite">
        {status}
      </p>
    </div>
  );
}

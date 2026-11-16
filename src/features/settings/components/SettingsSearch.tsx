import { SearchIcon, XIcon } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { filterSettings } from "../lib/filter";

/**
 * A search box over the settings: only the settings matching every word stay shown, with their
 * section's heading (`lib/filter.ts`). Filtered again when a section's content changes (git
 * settings arrive later, a list grows).
 */
export function SettingsSearch({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState("");
  const [empty, setEmpty] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const apply = () => {
      setEmpty(filterSettings(element, query) === 0);
    };
    apply();
    // Only structure and text: the filter's own `hidden` changes must not run it again.
    const observer = new MutationObserver(apply);
    observer.observe(element, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
    };
  }, [query]);

  return (
    <>
      <div className="relative">
        <SearchIcon
          className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          type="search"
          aria-label="Search settings"
          placeholder="Search settings"
          value={query}
          spellCheck={false}
          className="h-8 w-full rounded-md border border-border bg-background pr-8 pl-8 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-search-cancel-button]:hidden"
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape" && query) {
              event.stopPropagation();
              setQuery("");
            }
          }}
        />
        {query ? (
          <button
            type="button"
            aria-label="Clear the search"
            className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            onClick={() => {
              setQuery("");
            }}
          >
            <XIcon className="size-4" />
          </button>
        ) : null}
      </div>
      {empty ? (
        <p className="text-sm text-muted-foreground">No setting matches “{query}”.</p>
      ) : null}
      <div ref={root} className="space-y-8">
        {children}
      </div>
    </>
  );
}

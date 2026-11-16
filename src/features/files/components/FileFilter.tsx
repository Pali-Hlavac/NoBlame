import { SearchIcon, XIcon } from "lucide-react";

import { useFilesStore, useFilter } from "../store/files";

/**
 * The Files module's filter box: words a path must hold (searched in the whole tree). Clearing
 * it opens the folders above the file with the cursor, so the tree shows where it is.
 */
export function FileFilter({ repoPath }: { repoPath: string }) {
  const filter = useFilter(repoPath);
  const clear = () => {
    const { setFilter, reveal, cursor } = useFilesStore.getState();
    const at = cursor[repoPath];
    if (at !== undefined) reveal(repoPath, at);
    setFilter(repoPath, "");
  };
  return (
    <div className="relative min-w-0 flex-1">
      <SearchIcon
        className="pointer-events-none absolute top-1/2 left-1.5 size-3.5 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <input
        type="search"
        aria-label="Filter the files"
        placeholder="Filter the files"
        value={filter}
        spellCheck={false}
        className="h-6 w-full rounded-sm border border-border bg-background pr-6 pl-6 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-search-cancel-button]:hidden"
        onChange={(event) => {
          useFilesStore.getState().setFilter(repoPath, event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && filter) {
            event.stopPropagation();
            clear();
          }
        }}
      />
      {filter ? (
        <button
          type="button"
          aria-label="Clear the filter"
          className="absolute top-1/2 right-1 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          onClick={clear}
        >
          <XIcon className="size-3" />
        </button>
      ) : null}
    </div>
  );
}

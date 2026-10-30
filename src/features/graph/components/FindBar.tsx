import { ChevronDownIcon, ChevronUpIcon, SearchIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { select } from "@/features/selection";
import { toIpcError } from "@/shared/ipc/client";
import { cn } from "@/shared/lib/cn";

import { findCommit } from "../api/find";
import { selectedRowOf } from "../api/reload";
import { FIND_DELAY_MS } from "../lib/constants";
import { useGraphViewStore } from "../store/graphView";

type Status =
  | { kind: "idle" }
  | { kind: "searching" }
  | { kind: "found"; position: number; total: number }
  | { kind: "none" }
  | { kind: "error"; message: string };

const counts = new Intl.NumberFormat("en-US");

function statusText(status: Status): string {
  switch (status.kind) {
    case "idle":
      return "";
    case "searching":
      return "Searching…";
    case "found":
      return `${counts.format(status.position)} of ${counts.format(status.total)}`;
    case "none":
      return "No matches";
    case "error":
      return status.message;
  }
}

const ICON_BUTTON =
  "flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-40";

/**
 * Find in the commit list (Ctrl+F): commit ids, branch and tag names, authors and messages.
 * Typing jumps to the first match from the selected commit on; Enter and Shift+Enter go to the
 * next (older) and previous (newer) match, wrapping around; Esc closes.
 */
export function FindBar({ repoId, repoPath }: { repoId: number; repoPath: string }) {
  const request = useGraphViewStore((state) => state.findOpen[repoPath] ?? 0);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const input = useRef<HTMLInputElement>(null);
  // Answers to older searches are dropped.
  const latest = useRef(0);

  useEffect(() => {
    if (request > 0) input.current?.select();
  }, [request]);

  const search = async (backwards: boolean, includeSelected: boolean): Promise<void> => {
    const text = query.trim();
    const ticket = ++latest.current;
    if (text === "") {
      setStatus({ kind: "idle" });
      return;
    }
    const selected = selectedRowOf(repoPath);
    // Searching forward from the row above the selection finds the selection itself first.
    const from = selected === null ? null : includeSelected && !backwards ? selected - 1 : selected;
    setStatus({ kind: "searching" });
    try {
      const found = await findCommit(
        repoId,
        text,
        from !== null && from < 0 ? null : from,
        backwards,
      );
      if (ticket !== latest.current) return;
      if (found.row === null) {
        setStatus({ kind: "none" });
      } else {
        select(repoPath, { kind: "commit", row: found.row });
        setStatus({ kind: "found", position: found.position, total: found.total });
      }
    } catch (error) {
      const { code, message } = toIpcError(error);
      if (ticket === latest.current && code !== "CANCELLED") setStatus({ kind: "error", message });
    }
  };

  // Typing searches after a short pause, from the selected commit on.
  useEffect(() => {
    if (request === 0) return;
    const timer = setTimeout(() => {
      void search(false, true);
    }, FIND_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
    // Only the text starts a search; `search` reads the rest when it runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, request > 0]);

  if (request === 0) return null;
  const close = () => {
    latest.current++;
    useGraphViewStore.getState().setFindOpen(repoPath, false);
  };
  return (
    <div
      role="search"
      aria-label="Find commits"
      className="flex h-8 shrink-0 items-center gap-1.5 border-b border-border px-2"
    >
      <label className="flex h-6 min-w-0 flex-1 items-center gap-1.5 rounded border border-border px-1.5 text-xs focus-within:ring-2 focus-within:ring-ring">
        <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <input
          ref={input}
          type="search"
          aria-label="Find commits by id, branch, tag, author or message"
          placeholder="Find by id, branch, tag, author or message"
          value={query}
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void search(event.shiftKey, false);
            } else if (event.key === "Escape") {
              event.preventDefault();
              close();
            }
          }}
        />
      </label>
      <span
        aria-live="polite"
        className={cn(
          "max-w-48 shrink-0 truncate text-xs tabular-nums",
          status.kind === "error" ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {statusText(status)}
      </span>
      <button
        type="button"
        aria-label="Previous match (Shift+Enter)"
        title="Previous match (Shift+Enter)"
        disabled={query.trim() === ""}
        className={ICON_BUTTON}
        onClick={() => void search(true, false)}
      >
        <ChevronUpIcon className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        aria-label="Next match (Enter)"
        title="Next match (Enter)"
        disabled={query.trim() === ""}
        className={ICON_BUTTON}
        onClick={() => void search(false, false)}
      >
        <ChevronDownIcon className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        aria-label="Close find (Esc)"
        title="Close (Esc)"
        className={ICON_BUTTON}
        onClick={close}
      >
        <XIcon className="size-4" aria-hidden />
      </button>
    </div>
  );
}

/**
 * The editor's search: the query, its matches, and stepping through them. Typing opens the
 * first tab with a match when the open one has none; Enter / Shift+Enter move to the next /
 * previous match, across tabs, and scroll it into view.
 */
import { type RefObject, useEffect, useMemo, useState } from "react";

import { useKeys } from "@/shared/hooks/useKeys";
import type { RemoteSettingsDto } from "@/shared/ipc/bindings";
import { matchesHotkey } from "@/shared/lib/hotkeys";
import { isMacPlatform } from "@/shared/lib/platform";

import type { Draft } from "../../lib/settings/draft";
import type { RemoteTab } from "../../lib/settings/registry";
import { searchRemote } from "../../lib/settings/search";
import type { Highlight } from "./highlight";

export function useEditorSearch(
  base: RemoteSettingsDto,
  draft: Draft,
  tab: RemoteTab,
  setTab: (tab: RemoteTab) => void,
) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(-1);
  const result = useMemo(() => searchRemote(query, base, draft), [query, base, draft]);
  const matches = result?.matches ?? [];
  const active = index >= 0 ? matches[index] : undefined;
  const highlight: Highlight = useMemo(
    () => ({
      matched: new Set(result?.matches.map((match) => match.id) ?? []),
      active: active?.id ?? null,
    }),
    [result, active],
  );

  useEffect(() => {
    if (!active) return;
    const frame = requestAnimationFrame(() => {
      document
        .querySelector(`[data-setting-id="${CSS.escape(active.id)}"]`)
        ?.scrollIntoView({ block: "nearest" });
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [active]);

  const change = (next: string) => {
    setQuery(next);
    setIndex(-1);
    const found = searchRemote(next, base, draft);
    const first = found?.matches[0];
    if (found && first && !found.counts.get(tab)) setTab(first.tab);
  };
  const step = (delta: 1 | -1) => {
    const count = matches.length;
    if (count === 0) return;
    const next = index < 0 ? (delta === 1 ? 0 : count - 1) : (index + delta + count) % count;
    setIndex(next);
    const match = matches[next];
    if (match) setTab(match.tab);
  };
  return { query, change, step, result, highlight, position: index };
}

/** Focuses `input` on the Find key (Ctrl+F) while the editor is open, before the graph's Find. */
export function useFindKey(input: RefObject<HTMLInputElement | null>): void {
  const combo = useKeys("history.find");
  useEffect(() => {
    const isMac = isMacPlatform();
    const onKeyDown = (event: KeyboardEvent) => {
      if (!matchesHotkey(event, combo, isMac)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      input.current?.focus();
      input.current?.select();
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
    };
  }, [combo, input]);
}

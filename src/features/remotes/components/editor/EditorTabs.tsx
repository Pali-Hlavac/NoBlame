import { type KeyboardEvent, useRef } from "react";

import { cn } from "@/shared/lib/cn";

import { panelId, tabId } from "../../lib/settings/words";

export interface EditorTab<T extends string> {
  id: T;
  label: string;
  /** Shown after the label (search matches, changes); dimmed tabs have nothing to show. */
  badge?: string;
  dimmed?: boolean;
}

interface EditorTabsProps<T extends string> {
  /** Names the tab list and prefixes the ids that tie tabs to panels. */
  label: string;
  idPrefix: string;
  tabs: readonly EditorTab<T>[];
  value: T;
  onChange: (tab: T) => void;
}

/** A row of tabs: one tab stop, arrow keys, Home and End move between them. */
export function EditorTabs<T extends string>({
  label,
  idPrefix,
  tabs,
  value,
  onChange,
}: EditorTabsProps<T>) {
  const list = useRef<HTMLDivElement>(null);

  const move = (event: KeyboardEvent) => {
    const index = tabs.findIndex((tab) => tab.id === value);
    const last = tabs.length - 1;
    const next =
      event.key === "ArrowRight"
        ? index === last
          ? 0
          : index + 1
        : event.key === "ArrowLeft"
          ? index === 0
            ? last
            : index - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    const tab = next === null ? undefined : tabs[next];
    if (!tab) return;
    event.preventDefault();
    onChange(tab.id);
    list.current?.querySelector<HTMLElement>(`#${CSS.escape(tabId(idPrefix, tab.id))}`)?.focus();
  };

  return (
    <div ref={list} role="tablist" aria-label={label} className="flex gap-1 border-b border-border">
      {tabs.map((tab) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            id={tabId(idPrefix, tab.id)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId(idPrefix, tab.id)}
            tabIndex={selected ? 0 : -1}
            className={cn(
              "-mb-px border-b-2 px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
              tab.dimmed && !selected && "opacity-50",
            )}
            onClick={() => {
              onChange(tab.id);
            }}
            onKeyDown={move}
          >
            {tab.label}
            {tab.badge ? (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 text-xs text-muted-foreground">
                {tab.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { useElementSize } from "@/shared/hooks/useElementSize";
import { cn } from "@/shared/lib/cn";
import { nextRow } from "@/shared/lib/listNavigation";

/** Rows rendered above and below the visible ones, so fast scrolling shows no gaps. */
const OVERSCAN_ROWS = 8;

interface VirtualListProps {
  /** Number of rows. */
  count: number;
  /** Height of every row in CSS pixels. */
  rowHeight: number;
  /** Accessible name of the list. */
  label: string;
  /** Row with keyboard focus (highlighted); controlled by the caller. */
  activeIndex: number | undefined;
  onActiveChange: (index: number) => void;
  /** Enter, or pressing the mouse on a row. */
  onActivate: (index: number) => void;
  /** Content of one row. */
  renderRow: (index: number, active: boolean) => ReactNode;
  /** Accessible text of one row (screen readers announce it). */
  rowLabel: (index: number) => string;
  className?: string;
}

/**
 * A long list with fixed-height rows that renders only what is on screen. Keyboard: arrows,
 * Page Up/Down, Home/End move the active row; Enter activates it. One tab stop, like a listbox.
 */
export function VirtualList(props: VirtualListProps) {
  const { count, rowHeight, label, activeIndex, onActiveChange, onActivate } = props;
  const scrollRef = useRef<HTMLDivElement>(null);
  const size = useElementSize(scrollRef);
  const [scrollTop, setScrollTop] = useState(0);
  const idPrefix = useId();

  const first = Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN_ROWS);
  const last = Math.min(
    count - 1,
    Math.ceil((scrollTop + size.height) / rowHeight) + OVERSCAN_ROWS,
  );

  // Keep the active row visible when it changes.
  useEffect(() => {
    const element = scrollRef.current;
    if (!element || activeIndex === undefined) return;
    const top = activeIndex * rowHeight;
    if (top < element.scrollTop) element.scrollTop = top;
    else if (top + rowHeight > element.scrollTop + element.clientHeight) {
      element.scrollTop = top + rowHeight - element.clientHeight;
    }
  }, [activeIndex, rowHeight]);

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Enter" && activeIndex !== undefined) {
      event.preventDefault();
      onActivate(activeIndex);
      return;
    }
    const next = nextRow(event.key, activeIndex, count, Math.floor(size.height / rowHeight));
    if (next === null) return;
    event.preventDefault();
    onActiveChange(next);
  };

  const rows = [];
  for (let index = first; index <= last; index++) {
    const active = index === activeIndex;
    rows.push(
      <div
        key={index}
        id={`${idPrefix}-${index}`}
        role="option"
        aria-selected={active}
        aria-label={props.rowLabel(index)}
        className="absolute right-0 left-0"
        style={{ top: index * rowHeight, height: rowHeight }}
        tabIndex={-1}
        onMouseDown={() => {
          onActiveChange(index);
          onActivate(index);
        }}
      >
        {props.renderRow(index, active)}
      </div>,
    );
  }

  return (
    <div
      ref={scrollRef}
      role="listbox"
      aria-label={label}
      aria-activedescendant={
        activeIndex !== undefined && activeIndex >= first && activeIndex <= last
          ? `${idPrefix}-${activeIndex}`
          : undefined
      }
      tabIndex={0}
      className={cn(
        "relative min-h-0 overflow-auto outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        props.className,
      )}
      onScroll={(event) => {
        setScrollTop(event.currentTarget.scrollTop);
      }}
      onKeyDown={onKeyDown}
    >
      <div style={{ height: count * rowHeight }}>{rows}</div>
    </div>
  );
}

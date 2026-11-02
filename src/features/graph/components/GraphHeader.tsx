import { useState, type DragEvent } from "react";

import { GRAPH_COLUMN_TITLES, isResizable } from "@/features/settings";
import type { GraphColumnId } from "@/shared/ipc/bindings";
import { cn } from "@/shared/lib/cn";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@/shared/ui/context-menu";

import type { ColumnActions } from "../hooks/useColumnLayout";
import type { ColumnLayout } from "../lib/columns";
import { ColumnContextMenuItems, ColumnMenuButton } from "./ColumnMenu";
import { ColumnResizer } from "./ColumnResizer";

/** Drag data of a column title being moved. */
const COLUMN_DRAG_TYPE = "application/x-noblame-graph-column";

const isColumnDrag = (event: DragEvent): boolean =>
  event.dataTransfer.types.includes(COLUMN_DRAG_TYPE);

/** Whether the pointer is on the right half of the element (drop after it). */
const onRightHalf = (event: DragEvent<HTMLElement>): boolean => {
  const rect = event.currentTarget.getBoundingClientRect();
  return event.clientX > rect.left + rect.width / 2;
};

interface GraphHeaderProps {
  columns: ColumnLayout;
  actions: ColumnActions;
}

/**
 * Column titles above the commit list. Drag a title to move its column, drag its right edge to
 * resize it; right-click (or the button at the end) chooses columns and how dates look.
 */
export function GraphHeader({ columns, actions }: GraphHeaderProps) {
  const [drop, setDrop] = useState<{ id: GraphColumnId; after: boolean } | null>(null);
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {/* The list below always keeps room for its scrollbar; so does the header, so the
            columns line up. The menu button sits in that room and the right padding. */}
        <div
          role="group"
          aria-label="Column titles"
          className="relative flex h-7 shrink-0 border-b border-border pr-[var(--scrollbar-size)] text-xs font-medium text-muted-foreground"
        >
          <div
            className="grid min-w-0 flex-1 items-center gap-3 pr-3"
            style={{ gridTemplateColumns: columns.template }}
          >
            {columns.cells.map(({ id, widthPx }, index) => {
              const movable = id !== "graph";
              const title = GRAPH_COLUMN_TITLES[id];
              return (
                <div
                  key={id}
                  className={cn(
                    "relative flex h-full min-w-0 items-center",
                    id === "graph" && "pl-2",
                    movable && "cursor-grab",
                    drop?.id === id &&
                      (drop.after
                        ? "shadow-[inset_-2px_0_0_var(--primary)]"
                        : "shadow-[inset_2px_0_0_var(--primary)]"),
                  )}
                  draggable={movable}
                  onDragStart={(event) => {
                    event.dataTransfer.setData(COLUMN_DRAG_TYPE, id);
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(event) => {
                    if (!isColumnDrag(event)) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    const after = id === "graph" || onRightHalf(event);
                    if (drop?.id !== id || drop.after !== after) setDrop({ id, after });
                  }}
                  onDragLeave={() => {
                    setDrop(null);
                  }}
                  onDrop={(event) => {
                    const moved = event.dataTransfer.getData(COLUMN_DRAG_TYPE);
                    setDrop(null);
                    if (!moved) return;
                    event.preventDefault();
                    actions.move(moved as GraphColumnId, id, id === "graph" || onRightHalf(event));
                  }}
                  onDragEnd={() => {
                    setDrop(null);
                  }}
                >
                  {/* A hidden graph keeps an empty first cell. */}
                  {widthPx !== 0 && <span className="truncate">{title}</span>}
                  {isResizable(id) && widthPx !== null && widthPx > 0 && (
                    <ColumnResizer
                      title={title}
                      last={index === columns.cells.length - 1}
                      widthPx={widthPx}
                      onPreview={(width) => {
                        actions.preview(id, width);
                      }}
                      onResize={(width) => {
                        actions.resize(id, width);
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <div className="absolute top-1 right-0.5">
            <ColumnMenuButton />
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ColumnContextMenuItems />
      </ContextMenuContent>
    </ContextMenu>
  );
}

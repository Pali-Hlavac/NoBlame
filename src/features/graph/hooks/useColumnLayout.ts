import { useState } from "react";

import { moveColumn, updateColumn, useGraphColumns } from "@/features/settings";
import type { DateDisplay, GraphColumnId } from "@/shared/ipc/bindings";

import { layoutColumns, type ColumnLayout } from "../lib/columns";

export interface ColumnActions {
  /** Shows a width while a column edge is dragged, without saving it. */
  preview: (id: GraphColumnId, widthPx: number) => void;
  /** Saves a width (`null`: back to the default). */
  resize: (id: GraphColumnId, widthPx: number | null) => void;
  /** Saves `moved` before `target`, or after it with `after`. */
  move: (moved: GraphColumnId, target: GraphColumnId, after: boolean) => void;
}

/**
 * The commit list's columns from Settings, laid out for a table `tableWidthPx` wide, and the
 * actions of the column header. Widths being dragged are kept here until the drag ends.
 */
export function useColumnLayout(
  tableWidthPx: number,
  autoGraphWidthPx: number,
): {
  layout: ColumnLayout;
  dateDisplay: DateDisplay;
  showMessageBody: boolean;
  actions: ColumnActions;
} {
  const { columns, dateDisplay, showMessageBody, setColumns } = useGraphColumns();
  const [dragged, setDragged] = useState<{ id: GraphColumnId; widthPx: number } | null>(null);
  const shown = dragged ? updateColumn(columns, dragged.id, { width: dragged.widthPx }) : columns;
  return {
    layout: layoutColumns(tableWidthPx, autoGraphWidthPx, shown),
    dateDisplay,
    showMessageBody,
    actions: {
      preview: (id, widthPx) => {
        setDragged({ id, widthPx });
      },
      resize: (id, widthPx) => {
        setDragged(null);
        setColumns(updateColumn(columns, id, { width: widthPx }));
      },
      move: (moved, target, after) => {
        setColumns(moveColumn(columns, moved, target, after));
      },
    },
  };
}

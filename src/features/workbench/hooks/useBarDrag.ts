import { useState, type DragEvent } from "react";

import type { BarUnit } from "../lib/activityBar";
import { dropUnit } from "../lib/barActions";

/** Drag data type of an activity bar icon (its unit's id). */
const UNIT_MIME = "application/x-noblame-module-icon";

/** Where a dragged icon would land: before or after the unit `id`. */
export interface BarDrop {
  id: string;
  after: boolean;
}

/** The props one unit's element takes, and where a drag is. */
export interface BarDrag {
  unitProps: (unit: BarUnit) => {
    draggable: boolean;
    onDragStart: (event: DragEvent) => void;
    onDragOver: (event: DragEvent) => void;
    onDragLeave: () => void;
    onDrop: (event: DragEvent) => void;
    onDragEnd: () => void;
  };
  /** The unit being dragged. */
  dragged: string | null;
  drop: BarDrop | null;
}

/**
 * Reordering the activity bar by dragging an icon (a stack's frame moves whole) onto another:
 * the upper half drops it before, the lower half after. HTML drag and drop, as the docks use.
 */
export function useBarDrag(units: readonly BarUnit[], locked: boolean): BarDrag {
  const [dragged, setDragged] = useState<string | null>(null);
  const [drop, setDrop] = useState<BarDrop | null>(null);
  const end = (): void => {
    setDragged(null);
    setDrop(null);
  };
  const isOurs = (event: DragEvent) => event.dataTransfer.types.includes(UNIT_MIME);
  return {
    dragged,
    drop,
    unitProps: (unit) => ({
      draggable: !locked,
      onDragStart: (event) => {
        event.dataTransfer.setData(UNIT_MIME, unit.id);
        event.dataTransfer.effectAllowed = "move";
        setDragged(unit.id);
      },
      onDragOver: (event) => {
        if (locked || !isOurs(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        const box = event.currentTarget.getBoundingClientRect();
        const after = event.clientY > box.top + box.height / 2;
        if (drop?.id !== unit.id || drop.after !== after) setDrop({ id: unit.id, after });
      },
      onDragLeave: () => {
        if (drop?.id === unit.id) setDrop(null);
      },
      onDrop: (event) => {
        if (!isOurs(event)) return;
        event.preventDefault();
        const moved = units.find((other) => other.id === event.dataTransfer.getData(UNIT_MIME));
        const box = event.currentTarget.getBoundingClientRect();
        if (moved) dropUnit(moved, unit, event.clientY > box.top + box.height / 2);
        end();
      },
      onDragEnd: end,
    }),
  };
}

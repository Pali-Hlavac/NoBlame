import { useRef, useState, type DragEvent } from "react";

/**
 * Makes an element a drop target for drags that `accepts` approves. `over` is true while such a
 * drag is above it (children included: enter and leave are counted).
 */
export function useDropTarget(
  accepts: (event: DragEvent) => boolean,
  onDrop: (event: DragEvent) => void,
) {
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  const reset = (): void => {
    depth.current = 0;
    setOver(false);
  };
  return {
    over,
    props: {
      onDragEnter: (event: DragEvent) => {
        if (!accepts(event)) return;
        event.preventDefault();
        depth.current += 1;
        setOver(true);
      },
      onDragOver: (event: DragEvent) => {
        if (!accepts(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      },
      onDragLeave: (event: DragEvent) => {
        if (!accepts(event)) return;
        depth.current -= 1;
        if (depth.current <= 0) reset();
      },
      onDrop: (event: DragEvent) => {
        if (!accepts(event)) return;
        event.preventDefault();
        event.stopPropagation();
        reset();
        onDrop(event);
      },
    },
  };
}

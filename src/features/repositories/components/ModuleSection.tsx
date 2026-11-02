import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import type { ReactNode } from "react";

import type { RepositoriesSection } from "@/shared/ipc/bindings";
import { cn } from "@/shared/lib/cn";

import { useDropTarget } from "../hooks/useDropTarget";
import { droppedSection, isSectionDrag, onLowerHalf, startSectionDrag } from "../lib/dragData";
import { DROP_TARGET_CLASSES } from "./GroupedRepository";

interface ModuleSectionProps {
  id: RepositoriesSection;
  title: string;
  collapsed: boolean;
  onToggle: () => void;
  /** Moves `moved` before this section, or after it when dropped on its lower half. */
  onDropSection: (moved: RepositoriesSection, after: boolean) => void;
  /** Moves this section up (-1) or down (1): Alt+Up / Alt+Down on its title. */
  onMove: (offset: number) => void;
  children: ReactNode;
}

/**
 * A section of the Repositories module: its title folds it, and dragging the title (or Alt+Up /
 * Alt+Down) moves it. Another section can be dropped anywhere on it.
 */
export function ModuleSection(props: ModuleSectionProps) {
  const { id, title, collapsed } = props;
  const drop = useDropTarget(isSectionDrag, (event) => {
    const moved = droppedSection(event);
    if (moved && moved !== id) props.onDropSection(moved, onLowerHalf(event));
  });
  const Chevron = collapsed ? ChevronRightIcon : ChevronDownIcon;
  return (
    <section
      aria-label={title}
      className={cn("space-y-0.5 rounded-md", drop.over && DROP_TARGET_CLASSES)}
      {...drop.props}
    >
      <h3>
        <button
          draggable
          aria-expanded={!collapsed}
          title="Click to fold; drag (or Alt+Up / Alt+Down) to move"
          className="flex w-full items-center gap-1 rounded-sm px-1 pt-2 text-xs font-semibold text-muted-foreground uppercase outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          onClick={props.onToggle}
          onDragStart={(event) => {
            startSectionDrag(event, id);
          }}
          onKeyDown={(event) => {
            if (!event.altKey) return;
            if (event.key === "ArrowUp" || event.key === "ArrowDown") {
              event.preventDefault();
              props.onMove(event.key === "ArrowUp" ? -1 : 1);
            }
          }}
        >
          <Chevron className="size-3.5" aria-hidden />
          {title}
        </button>
      </h3>
      {!collapsed && props.children}
    </section>
  );
}

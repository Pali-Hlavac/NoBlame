import { ChevronDownIcon, ChevronRightIcon, type LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/shared/lib/cn";
import { KIND_ICON_CLASSES, type WorkKind } from "@/shared/lib/workKinds";

/** Indentation per tree level, in CSS pixels. */
const INDENT_PX = 14;

/**
 * Other `div` props (drag and drop, a context menu trigger's handlers and ref) go to the row
 * itself.
 */
interface RepositoryTreeRowProps extends Omit<ComponentProps<"div">, "title" | "children"> {
  icon: LucideIcon;
  /** Colours the icon: `groups`, `repositories` or `submodules`. */
  iconKind: WorkKind;
  label: string;
  title: string;
  depth: number;
  /** `undefined`: no children, so no expander. */
  expanded: boolean | undefined;
  /** Called by the expander (only rows with children have one). */
  onToggle?: () => void;
  onOpen: (() => void) | undefined;
  current?: boolean;
  /** Shown in bold, e.g. a submodule that has a tab open. */
  emphasized?: boolean;
  dimmed?: boolean;
  /** Shown at the right end, e.g. a remove button. */
  actions?: ReactNode;
  /** Shown after the name, right-aligned, e.g. the uncommitted file counts. */
  badge?: ReactNode;
  /** Replaces the name, e.g. with a field to rename it. */
  labelSlot?: ReactNode;
}

/** One row of the repository tree: expander, icon and name. */
export function RepositoryTreeRow(props: RepositoryTreeRowProps) {
  const {
    icon: Icon,
    iconKind,
    label,
    title,
    depth,
    expanded,
    onToggle,
    onOpen,
    current,
    emphasized,
    dimmed,
    actions,
    badge,
    labelSlot,
    className,
    style,
    ...rowProps
  } = props;
  const Chevron = expanded ? ChevronDownIcon : ChevronRightIcon;
  return (
    <div
      {...rowProps}
      className={cn(
        "group flex items-center rounded-md hover:bg-accent",
        current && "bg-accent text-accent-foreground",
        className,
      )}
      style={{ paddingLeft: depth * INDENT_PX, ...style }}
    >
      {expanded === undefined ? (
        <span className="size-5 shrink-0" />
      ) : (
        <button
          aria-label={`${expanded ? "Collapse" : "Expand"} ${label}`}
          aria-expanded={expanded}
          className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onToggle}
        >
          <Chevron className="size-3.5" aria-hidden />
        </button>
      )}
      {labelSlot ? (
        <span className="flex min-w-0 flex-1 items-center gap-2 px-1 py-0.5">
          <Icon className={cn("size-4 shrink-0", KIND_ICON_CLASSES[iconKind])} aria-hidden />
          {labelSlot}
        </span>
      ) : (
        <button
          title={title}
          aria-current={current ? "page" : undefined}
          disabled={!onOpen}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default",
            dimmed && "opacity-50",
          )}
          onClick={onOpen}
        >
          <Icon className={cn("size-4 shrink-0", KIND_ICON_CLASSES[iconKind])} aria-hidden />
          <span className={cn("truncate", emphasized && "font-medium")}>{label}</span>
          {badge}
        </button>
      )}
      {actions}
    </div>
  );
}

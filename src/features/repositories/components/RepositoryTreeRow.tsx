import { ChevronDownIcon, ChevronRightIcon, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/shared/lib/cn";

/** Indentation per tree level, in CSS pixels. */
const INDENT_PX = 14;

interface RepositoryTreeRowProps {
  icon: LucideIcon;
  label: string;
  title: string;
  depth: number;
  /** `undefined`: no children, so no expander. */
  expanded: boolean | undefined;
  /** Called by the expander (only rows with children have one). */
  onToggle?: () => void;
  onOpen: (() => void) | undefined;
  current?: boolean;
  dimmed?: boolean;
  /** Shown at the right end, e.g. a remove button. */
  actions?: ReactNode;
}

/** One row of the repository tree: expander, icon and name. */
export function RepositoryTreeRow(props: RepositoryTreeRowProps) {
  const { icon: Icon, label, depth, expanded, onToggle, onOpen } = props;
  const Chevron = expanded ? ChevronDownIcon : ChevronRightIcon;
  return (
    <div
      className={cn(
        "group flex items-center rounded-md hover:bg-accent",
        props.current && "bg-accent text-accent-foreground",
      )}
      style={{ paddingLeft: depth * INDENT_PX }}
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
      <button
        title={props.title}
        aria-current={props.current ? "page" : undefined}
        disabled={!onOpen}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default",
          props.dimmed && "opacity-50",
        )}
        onClick={onOpen}
      >
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="truncate">{label}</span>
      </button>
      {props.actions}
    </div>
  );
}

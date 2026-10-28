import { ChevronDownIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Tooltip } from "@/shared/ui/tooltip";

import type { ToolbarAction } from "../types";

/** Tooltip text: what it does, or which milestone delivers it. */
function hint(action: ToolbarAction): string {
  return action.milestone ? `${action.label}: arrives in ${action.milestone}` : action.label;
}

/**
 * A toolbar button. Stubs stay focusable (`aria-disabled`, not `disabled`) so their tooltip can
 * say which milestone delivers them, also to keyboard users.
 */
function ActionButton({ action, className }: { action: ToolbarAction; className?: string }) {
  const Icon = action.icon;
  const stub = action.milestone !== undefined || !action.run;
  return (
    <Tooltip content={hint(action)}>
      <Button
        variant="ghost"
        size="sm"
        aria-disabled={stub}
        aria-label={hint(action)}
        className={cn("h-7 gap-1.5 px-2", stub && "opacity-50", className)}
        onClick={() => {
          if (!stub) action.run?.();
        }}
      >
        <Icon aria-hidden />
        <span className="hidden @3xl:inline">{action.label}</span>
      </Button>
    </Tooltip>
  );
}

/** A main action plus a menu of related ones (e.g. Pull ▾ with Fetch and Fetch and prune). */
function SplitButton({ action }: { action: ToolbarAction }) {
  const items = action.menu ?? [];
  return (
    <div className="flex items-center">
      <ActionButton action={action} className="rounded-r-none pr-1" />
      <DropdownMenu>
        <Tooltip content={`More ${action.label.toLowerCase()} actions`}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-5 rounded-l-none"
              aria-label={`More ${action.label.toLowerCase()} actions`}
            >
              <ChevronDownIcon aria-hidden />
            </Button>
          </DropdownMenuTrigger>
        </Tooltip>
        <DropdownMenuContent align="start">
          {items.map((item) => {
            const Icon = item.icon;
            const stub = item.milestone !== undefined || !item.run;
            return (
              <DropdownMenuItem
                key={item.id}
                disabled={stub}
                onSelect={() => {
                  if (!stub) item.run?.();
                }}
              >
                <Icon aria-hidden />
                <span className="flex-1">{item.label}</span>
                {item.milestone && (
                  <span className="text-xs text-muted-foreground">{item.milestone}</span>
                )}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

interface WorkbenchToolbarProps {
  /** Buttons from left to right; an action with a `menu` becomes a split button. */
  actions: readonly ToolbarAction[];
  /** Shown at the right end (status of the active repository, palette button). */
  end?: ReactNode;
}

/** The bar above the document dock; labels hide when it gets narrow. */
export function WorkbenchToolbar({ actions, end }: WorkbenchToolbarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Repository actions"
      data-workbench-region="toolbar"
      className="@container flex h-9 shrink-0 items-center gap-0.5 border-b border-border bg-muted/40 px-2"
    >
      {actions.map((action) =>
        action.menu ? (
          <SplitButton key={action.id} action={action} />
        ) : (
          <ActionButton key={action.id} action={action} />
        ),
      )}
      <div className="flex min-w-0 flex-1 items-center justify-end gap-1">{end}</div>
    </div>
  );
}

import type { LucideIcon } from "lucide-react";

import { cn } from "@/shared/lib/cn";
import { Tooltip } from "@/shared/ui/tooltip";

interface ActivityBarButtonProps {
  /** Accessible name and tooltip (include the shortcut, if any). */
  label: string;
  icon: LucideIcon;
  /** Colours the icon (by kind of work); the text colour when missing. */
  iconClassName?: string;
  /** Shows a bar on the left, like VS Code, while what it opens is visible. */
  pressed: boolean;
  onClick: () => void;
}

/** An icon button of the activity bar. */
export function ActivityBarButton({
  label,
  icon: Icon,
  iconClassName,
  pressed,
  onClick,
}: ActivityBarButtonProps) {
  return (
    <Tooltip content={label} side="right">
      <button
        aria-label={label}
        aria-pressed={pressed}
        className={cn(
          "relative flex size-9 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
          pressed &&
            "text-foreground before:absolute before:inset-y-1.5 before:-left-1 before:w-0.5 before:rounded-full before:bg-primary",
        )}
        onClick={onClick}
      >
        <Icon className={cn("size-5", iconClassName)} aria-hidden />
      </button>
    </Tooltip>
  );
}

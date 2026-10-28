import { formatHotkey } from "@/shared/lib/hotkeys";
import { cn } from "@/shared/lib/cn";
import { isMacPlatform } from "@/shared/lib/platform";
import { Tooltip } from "@/shared/ui/tooltip";

import { toggleModule } from "../lib/docks";
import { useWorkbenchStore } from "../store/workbench";
import type { WorkbenchModule } from "../types";

/** One icon per module on the far left; a click opens the module or hides the sidebar. */
export function ActivityBar({ modules }: { modules: readonly WorkbenchModule[] }) {
  const visible = useWorkbenchStore((state) => state.visibleModules);
  const collapsed = useWorkbenchStore((state) => state.sidebarCollapsed);
  const isMac = isMacPlatform();

  return (
    <nav
      aria-label="Modules"
      data-workbench-region="activity-bar"
      className="flex w-11 shrink-0 flex-col items-center gap-1 border-r border-border bg-muted/60 py-1"
    >
      {modules.map((module) => {
        const showing = !collapsed && visible.includes(module.id);
        const Icon = module.icon;
        const label = module.hotkey
          ? `${module.title} (${formatHotkey(module.hotkey, isMac)})`
          : module.title;
        return (
          <Tooltip key={module.id} content={label} side="right">
            <button
              aria-label={label}
              aria-pressed={showing}
              className={cn(
                "relative flex size-9 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
                showing &&
                  "text-foreground before:absolute before:inset-y-1.5 before:-left-1 before:w-0.5 before:rounded-full before:bg-primary",
              )}
              onClick={() => {
                toggleModule(module);
              }}
            >
              <Icon className="size-5" aria-hidden />
            </button>
          </Tooltip>
        );
      })}
    </nav>
  );
}

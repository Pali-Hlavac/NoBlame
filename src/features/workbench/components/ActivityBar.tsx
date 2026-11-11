import type { ReactNode } from "react";

import { useKeymap } from "@/shared/hooks/useKeys";
import { withHotkey } from "@/shared/lib/hotkeys";
import { isMacPlatform } from "@/shared/lib/platform";
import { kindIconClass } from "@/shared/lib/workKinds";

import { toggleModule } from "../lib/docks";
import { useWorkbenchStore } from "../store/workbench";
import type { WorkbenchModule } from "../types";
import { ActivityBarButton } from "./ActivityBarButton";

interface ActivityBarProps {
  modules: readonly WorkbenchModule[];
  /** Buttons pinned to the bottom (for example Settings); see {@link ActivityBarButton}. */
  footer?: ReactNode;
}

/** One icon per module on the far left; a click opens the module or hides the sidebar. */
export function ActivityBar({ modules, footer }: ActivityBarProps) {
  const visible = useWorkbenchStore((state) => state.visibleModules);
  const collapsed = useWorkbenchStore((state) => state.sidebarCollapsed);
  const isMac = isMacPlatform();
  const keysOf = useKeymap();

  return (
    <nav
      aria-label="Modules"
      data-workbench-region="activity-bar"
      className="flex w-11 shrink-0 flex-col items-center gap-1 border-r border-border bg-muted/60 py-1"
    >
      {modules.map((module) => (
        <ActivityBarButton
          key={module.id}
          label={withHotkey(
            module.title,
            module.keybinding ? keysOf(module.keybinding) : "",
            isMac,
          )}
          icon={module.icon}
          iconClassName={kindIconClass(module.kind)}
          pressed={!collapsed && visible.includes(module.id)}
          onClick={() => {
            toggleModule(module);
          }}
        />
      ))}
      {footer && <div className="mt-auto flex flex-col items-center gap-1">{footer}</div>}
    </nav>
  );
}

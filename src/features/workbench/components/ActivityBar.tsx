import { useState, type ReactNode } from "react";

import { useKeymap } from "@/shared/hooks/useKeys";
import { cn } from "@/shared/lib/cn";
import { withHotkey } from "@/shared/lib/hotkeys";
import { isMacPlatform } from "@/shared/lib/platform";
import { kindIconClass } from "@/shared/lib/workKinds";
import { ContextMenu, ContextMenuTrigger } from "@/shared/ui/context-menu";

import { useBarDrag } from "../hooks/useBarDrag";
import { barUnits, isHidden, type BarUnit } from "../lib/activityBar";
import { toggleModule } from "../lib/docks";
import { useWorkbenchStore } from "../store/workbench";
import type { WorkbenchModule } from "../types";
import { ActivityBarButton } from "./ActivityBarButton";
import { ActivityBarMenu } from "./ActivityBarMenu";
import { ActivityBarOverflow } from "./ActivityBarOverflow";

/** The bar beside an icon (or a stack's frame) whose module is showing, as in VS Code. */
const PRESSED_BAR =
  "before:absolute before:inset-y-1.5 before:-left-1 before:w-0.5 before:rounded-full before:bg-primary";

interface ActivityBarProps {
  modules: readonly WorkbenchModule[];
  /** Buttons pinned to the bottom (for example Settings); see {@link ActivityBarButton}. */
  footer?: ReactNode;
}

/**
 * One icon per module on the far left; a click opens the module or hides the sidebar. Stacked
 * modules are framed together. Icons can be dragged to another place (unless the bar is
 * locked); its right-click menu stacks, moves, hides icons and locks the bar; hidden icons are
 * under "…" above the footer.
 */
export function ActivityBar({ modules, footer }: ActivityBarProps) {
  const visible = useWorkbenchStore((state) => state.visibleModules);
  const collapsed = useWorkbenchStore((state) => state.sidebarCollapsed);
  const stacks = useWorkbenchStore((state) => state.stacks);
  const { order, hidden, locked } = useWorkbenchStore((state) => state.activityBar);
  const [menuUnit, setMenuUnit] = useState<BarUnit | null>(null);
  const isMac = isMacPlatform();
  const keysOf = useKeymap();
  const units = barUnits(modules, order, stacks);
  const shown = units.filter((unit) => !isHidden(unit, hidden));
  const hiddenUnits = units.filter((unit) => isHidden(unit, hidden));
  const drag = useBarDrag(units, locked);

  const button = (module: WorkbenchModule, inFrame: boolean) => (
    <ActivityBarButton
      key={module.id}
      label={withHotkey(module.title, module.keybinding ? keysOf(module.keybinding) : "", isMac)}
      icon={module.icon}
      iconClassName={kindIconClass(module.kind)}
      pressed={!collapsed && visible.includes(module.id)}
      indicator={!inFrame}
      onClick={() => {
        toggleModule(module);
      }}
    />
  );

  return (
    <ContextMenu modal={false}>
      <ContextMenuTrigger asChild>
        <nav
          aria-label="Modules"
          data-workbench-region="activity-bar"
          className="flex w-11 shrink-0 flex-col items-center gap-1 border-r border-border bg-muted/60 py-1"
          onContextMenuCapture={() => {
            setMenuUnit(null);
          }}
        >
          {shown.map((unit) => {
            const framed = unit.modules.length > 1;
            const pressed =
              !collapsed && unit.modules.some((module) => visible.includes(module.id));
            return (
              <div
                key={unit.id}
                role={framed ? "group" : undefined}
                aria-label={
                  framed ? unit.modules.map((module) => module.title).join(" + ") : undefined
                }
                {...drag.unitProps(unit)}
                onContextMenu={() => {
                  setMenuUnit(unit);
                }}
                className={cn(
                  "relative flex flex-col items-center",
                  framed && "gap-0.5 rounded-lg border border-border bg-background/40 p-px",
                  framed && pressed && PRESSED_BAR,
                  drag.dragged === unit.id && "opacity-40",
                  drag.drop?.id === unit.id &&
                    (drag.drop.after
                      ? "after:absolute after:inset-x-1 after:-bottom-1 after:h-0.5 after:rounded-full after:bg-primary"
                      : "after:absolute after:inset-x-1 after:-top-1 after:h-0.5 after:rounded-full after:bg-primary"),
                )}
              >
                {unit.modules.map((module) => button(module, framed))}
              </div>
            );
          })}
          <div className="mt-auto flex flex-col items-center gap-1">
            {hiddenUnits.length > 0 && <ActivityBarOverflow hidden={hiddenUnits} />}
            {footer}
          </div>
        </nav>
      </ContextMenuTrigger>
      <ActivityBarMenu unit={menuUnit} shown={shown} anyHidden={hiddenUnits.length > 0} />
    </ContextMenu>
  );
}

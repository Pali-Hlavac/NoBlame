import { ArrowDownIcon, ArrowUpIcon, EyeIcon, EyeOffIcon, ListRestartIcon } from "lucide-react";

import {
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
} from "@/shared/ui/context-menu";

import type { BarUnit } from "../lib/activityBar";
import { hideUnit, resetBarOrder, setBarLocked, showUnit, stepBarUnit } from "../lib/barActions";
import { useWorkbenchStore } from "../store/workbench";
import { StackMenuItems } from "./StackMenuItems";

interface ActivityBarMenuProps {
  /** The icon (or stack) right-clicked; `null` for the bar's empty space. */
  unit: BarUnit | null;
  /** The units shown in the bar, in order. */
  shown: readonly BarUnit[];
  /** Some units are hidden under "…". */
  anyHidden: boolean;
}

/** The activity bar's right-click menu: stack, move or hide an icon; lock or reset the bar. */
export function ActivityBarMenu({ unit, shown, anyHidden }: ActivityBarMenuProps) {
  const locked = useWorkbenchStore((state) => state.activityBar.locked);
  const index = unit ? shown.findIndex((other) => other.id === unit.id) : -1;
  return (
    <ContextMenuContent aria-label={unit ? "Module icon" : "Activity bar"}>
      {unit && (
        <>
          <ContextMenuLabel className="max-w-64 truncate">
            {unit.modules.map((module) => module.title).join(" + ")}
          </ContextMenuLabel>
          <ContextMenuSeparator />
          {unit.modules[0] && <StackMenuItems moduleId={unit.modules[0].id} />}
          <ContextMenuItem
            disabled={locked || index <= 0}
            onSelect={() => {
              stepBarUnit(shown, unit, -1);
            }}
          >
            <ArrowUpIcon aria-hidden />
            Move up
          </ContextMenuItem>
          <ContextMenuItem
            disabled={locked || index < 0 || index >= shown.length - 1}
            onSelect={() => {
              stepBarUnit(shown, unit, 1);
            }}
          >
            <ArrowDownIcon aria-hidden />
            Move down
          </ContextMenuItem>
          <ContextMenuItem
            disabled={locked}
            onSelect={() => {
              hideUnit(unit);
            }}
          >
            <EyeOffIcon aria-hidden />
            Hide (under …)
          </ContextMenuItem>
          <ContextMenuSeparator />
        </>
      )}
      <ContextMenuCheckboxItem checked={locked} onCheckedChange={setBarLocked}>
        Lock the icons
      </ContextMenuCheckboxItem>
      {anyHidden && (
        <ContextMenuItem
          disabled={locked}
          onSelect={() => {
            showUnit();
          }}
        >
          <EyeIcon aria-hidden />
          Show all icons
        </ContextMenuItem>
      )}
      <ContextMenuItem disabled={locked} onSelect={resetBarOrder}>
        <ListRestartIcon aria-hidden />
        Reset the order
      </ContextMenuItem>
    </ContextMenuContent>
  );
}

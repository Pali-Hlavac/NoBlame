import { EllipsisIcon, EyeIcon } from "lucide-react";

import { cn } from "@/shared/lib/cn";
import { kindIconClass } from "@/shared/lib/workKinds";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Tooltip } from "@/shared/ui/tooltip";

import type { BarUnit } from "../lib/activityBar";
import { showUnit } from "../lib/barActions";
import { toggleModule } from "../lib/docks";
import { useWorkbenchStore } from "../store/workbench";

function unitTitle(unit: BarUnit): string {
  return unit.modules.map((module) => module.title).join(" + ");
}

function UnitIcons({ unit }: { unit: BarUnit }) {
  return unit.modules.map((module) => {
    const Icon = module.icon;
    return <Icon key={module.id} className={kindIconClass(module.kind)} aria-hidden />;
  });
}

/** The "…" button above Settings: the hidden icons, to open their modules or show them again. */
export function ActivityBarOverflow({ hidden }: { hidden: readonly BarUnit[] }) {
  const locked = useWorkbenchStore((state) => state.activityBar.locked);
  return (
    <DropdownMenu>
      <Tooltip content="More modules" side="right">
        <DropdownMenuTrigger asChild>
          <button
            aria-label="More modules"
            className={cn(
              "flex size-9 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <EllipsisIcon className="size-5" aria-hidden />
          </button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent side="right" align="end">
        <DropdownMenuLabel>Hidden modules</DropdownMenuLabel>
        {hidden.map((unit) => (
          <DropdownMenuItem
            key={unit.id}
            onSelect={() => {
              if (unit.modules[0]) toggleModule(unit.modules[0]);
            }}
          >
            <UnitIcons unit={unit} />
            {unitTitle(unit)}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger disabled={locked}>
            <EyeIcon aria-hidden />
            Show in the activity bar
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {hidden.map((unit) => (
              <DropdownMenuItem
                key={unit.id}
                onSelect={() => {
                  showUnit(unit);
                }}
              >
                <UnitIcons unit={unit} />
                {unitTitle(unit)}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                showUnit();
              }}
            >
              All of them
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

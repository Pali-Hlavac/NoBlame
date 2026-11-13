import { Layers2Icon, SquareSplitVerticalIcon, UngroupIcon } from "lucide-react";

import { kindIconClass } from "@/shared/lib/workKinds";
import {
  ContextMenuItem,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/shared/ui/context-menu";

import { docks } from "../lib/docks";
import { stackModules, takeOutOfStack, unstack } from "../lib/stackDock";
import { stackOf } from "../lib/stacks";
import { useWorkbenchStore } from "../store/workbench";
import type { WorkbenchModule } from "../types";

function ModuleItem({ module, onSelect }: { module: WorkbenchModule; onSelect: () => void }) {
  const Icon = module.icon;
  return (
    <ContextMenuItem onSelect={onSelect}>
      <Icon className={kindIconClass(module.kind)} aria-hidden />
      {module.title}
    </ContextMenuItem>
  );
}

/**
 * Stack entries of a module's menus (its dock tab, its activity bar icon): **Stack with** another
 * module (below it, in one tab), and for a stacked module **Take … out** and **Unstack**. Only
 * modules that are not stacked or popped out can join.
 */
export function StackMenuItems({ moduleId }: { moduleId: string }) {
  const stacks = useWorkbenchStore((state) => state.stacks);
  const poppedOut = useWorkbenchStore((state) => state.poppedOut);
  const stack = stackOf(stacks, moduleId);
  const members = stack?.modules ?? [moduleId];
  const joinable = docks.registered.filter(
    (module) =>
      !members.includes(module.id) &&
      !poppedOut.includes(module.id) &&
      stackOf(stacks, module.id) === undefined,
  );
  const byId = new Map(docks.registered.map((module) => [module.id, module]));
  // A popped-out module shows in its popup, not in the dock.
  if (poppedOut.includes(moduleId)) return null;
  return (
    <>
      {joinable.length > 0 && (
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Layers2Icon aria-hidden />
            {stack ? "Add to this stack" : "Stack with"}
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {joinable.map((module) => (
              <ModuleItem
                key={module.id}
                module={module}
                onSelect={() => {
                  stackModules(moduleId, module.id);
                }}
              />
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
      )}
      {stack && (
        <>
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <SquareSplitVerticalIcon aria-hidden />
              Take out of the stack
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              {stack.modules.flatMap((id) => {
                const module = byId.get(id);
                return module ? (
                  <ModuleItem
                    key={id}
                    module={module}
                    onSelect={() => {
                      takeOutOfStack(id);
                    }}
                  />
                ) : (
                  []
                );
              })}
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuItem
            onSelect={() => {
              unstack(moduleId);
            }}
          >
            <UngroupIcon aria-hidden />
            Unstack
          </ContextMenuItem>
        </>
      )}
    </>
  );
}

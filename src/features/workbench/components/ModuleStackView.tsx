import { Fragment, useState } from "react";
import { Group, Panel, Separator, type Layout } from "react-resizable-panels";

import { kindIconClass } from "@/shared/lib/workKinds";

import { saveStackSizes } from "../lib/stackDock";
import type { ModuleStack } from "../lib/stacks";
import type { WorkbenchModule } from "../types";

/** A stacked module is never squeezed below this. */
const MODULE_MIN_HEIGHT = "64px";
/** Panels must not scroll (see `Workbench.tsx`); the modules scroll themselves. */
const PANEL_STYLE = { overflow: "hidden" } as const;

/** The saved shares of the stack's height, or none (equal shares). */
function initialLayout(stack: ModuleStack): Layout | undefined {
  const { sizes } = stack;
  if (!sizes) return undefined;
  return Object.fromEntries(stack.modules.map((id, index) => [id, sizes[index] ?? 0]));
}

interface ModuleStackViewProps {
  stack: ModuleStack;
  byId: ReadonlyMap<string, WorkbenchModule>;
}

/**
 * The modules of a stack one above the other in one dock tab, each under a small header with
 * its icon and title, with splitters between them. How the height is shared is saved with the
 * layout. Remounted (by its panel) when the stack changes.
 */
export function ModuleStackView({ stack, byId }: ModuleStackViewProps) {
  // Read once: the splitter would reset on every drag step if it followed the store.
  const [defaultLayout] = useState(() => initialLayout(stack));
  const modules = stack.modules.flatMap((id) => byId.get(id) ?? []);
  return (
    <Group
      orientation="vertical"
      className="h-full"
      defaultLayout={defaultLayout}
      onLayoutChanged={(layout) => {
        saveStackSizes(
          stack.modules,
          stack.modules.map((id) => layout[id] ?? 0),
        );
      }}
    >
      {modules.map((module, index) => {
        const Icon = module.icon;
        const Content = module.component;
        return (
          <Fragment key={module.id}>
            {index > 0 && (
              <Separator
                aria-label={`Resize ${module.title}`}
                className="h-px bg-border outline-none hover:bg-primary focus-visible:bg-ring data-[separator=active]:bg-primary"
              />
            )}
            <Panel id={module.id} minSize={MODULE_MIN_HEIGHT} style={PANEL_STYLE}>
              <section aria-label={module.title} className="flex h-full flex-col">
                <h2 className="flex h-6 shrink-0 items-center gap-1.5 border-b border-border bg-muted/50 px-2 text-xs font-medium text-muted-foreground">
                  <Icon className={kindIconClass(module.kind)} size={14} aria-hidden />
                  {module.title}
                </h2>
                {/* `relative`: see ModulePanel in ModuleDock.tsx. */}
                <div className="relative min-h-0 flex-1 overflow-hidden">
                  <Content />
                </div>
              </section>
            </Panel>
          </Fragment>
        );
      })}
    </Group>
  );
}

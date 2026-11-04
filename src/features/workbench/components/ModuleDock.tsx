import {
  DockviewReact,
  type DockviewApi,
  type DockviewReadyEvent,
  type IDockviewPanelProps,
  type SerializedDockview,
} from "dockview-react";
import { PanelLeftIcon } from "lucide-react";
import { createContext, useContext, useEffect, useRef } from "react";

import { EmptyState } from "@/shared/components/EmptyState";

import { docks, MODULE_COMPONENT, scheduleLayoutSave } from "../lib/docks";
import { DOCK_THEME } from "../lib/theme";
import type { ModuleParams } from "../lib/layout";
import { useWorkbenchStore } from "../store/workbench";
import type { WorkbenchModule } from "../types";
import { ModuleTab } from "./ModuleTab";

const ModulesContext = createContext<ReadonlyMap<string, WorkbenchModule>>(new Map());

function ModulePanel({ params }: IDockviewPanelProps<ModuleParams>) {
  const module = useContext(ModulesContext).get(params.moduleId);
  if (!module) return null;
  const Content = module.component;
  return (
    // Modules scroll themselves; a scrolling wrapper flashes scrollbars while the dock resizes.
    <div className="h-full overflow-hidden bg-muted/30">
      <Content />
    </div>
  );
}

function ModuleWatermark() {
  return (
    <EmptyState
      icon={PanelLeftIcon}
      title="No module open"
      description="Pick one in the activity bar."
      className="h-full"
    />
  );
}

const COMPONENTS = { [MODULE_COMPONENT]: ModulePanel };

/** Builds the default arrangement: one group per entry, top to bottom, modules as its tabs. */
function addDefaultModules(
  api: DockviewApi,
  layout: readonly (readonly string[])[],
  byId: ReadonlyMap<string, WorkbenchModule>,
): void {
  let previous: string | null = null;
  for (const group of layout) {
    let first: string | null = null;
    for (const id of group) {
      const module = byId.get(id);
      if (!module) continue;
      const params: ModuleParams = { moduleId: id };
      const reference = first ?? previous;
      api.addPanel({
        id,
        component: MODULE_COMPONENT,
        title: module.title,
        params,
        inactive: first !== null,
        ...(reference && {
          position: { referencePanel: reference, direction: first ? "within" : "below" },
        }),
      });
      first ??= id;
    }
    previous = first ?? previous;
  }
}

/** Mirrors which modules are open and in front into the store (for the activity bar). */
function publishModules(api: DockviewApi): void {
  const open = api.panels.map((panel) => panel.id);
  const visible = api.groups.flatMap((group) => group.activePanel?.id ?? []);
  useWorkbenchStore.getState().setModules(open, visible);
}

interface ModuleDockProps {
  modules: readonly WorkbenchModule[];
  /** Default arrangement: groups top to bottom, each a list of module ids shown as tabs. */
  defaultLayout: readonly (readonly string[])[];
  /** Arrangement saved by the previous session. */
  saved: SerializedDockview | null;
}

/** The left dock: modules opened from the activity bar, stacked as tabs or split. */
export function ModuleDock({ modules, defaultLayout, saved }: ModuleDockProps) {
  const byId = new Map(modules.map((module) => [module.id, module]));
  const disposables = useRef<{ dispose: () => void }[]>([]);

  useEffect(
    () => () => {
      disposables.current.forEach((disposable) => {
        disposable.dispose();
      });
      disposables.current = [];
      docks.modules = null;
    },
    [],
  );

  const onReady = ({ api }: DockviewReadyEvent): void => {
    docks.modules = api;
    try {
      if (saved) api.fromJSON(saved);
    } catch (error) {
      console.warn("Ignoring the saved module layout", error);
      api.clear();
    }
    if (!saved || api.totalPanels === 0) addDefaultModules(api, defaultLayout, byId);
    // Modules removed from the app since the layout was saved, and popped-out ones.
    const { poppedOut } = useWorkbenchStore.getState();
    for (const panel of [...api.panels]) {
      if (!byId.has(panel.id) || poppedOut.includes(panel.id)) panel.api.close();
    }
    publishModules(api);
    const onChange = (): void => {
      publishModules(api);
      scheduleLayoutSave();
    };
    disposables.current.push(
      api.onDidLayoutChange(onChange),
      api.onDidActivePanelChange(onChange),
      api.onDidAddPanel(onChange),
      api.onDidRemovePanel(onChange),
    );
  };

  return (
    <ModulesContext.Provider value={byId}>
      <DockviewReact
        className="h-full"
        theme={DOCK_THEME}
        components={COMPONENTS}
        defaultTabComponent={ModuleTab}
        watermarkComponent={ModuleWatermark}
        disableFloatingGroups
        onReady={onReady}
      />
    </ModulesContext.Provider>
  );
}

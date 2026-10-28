import "./dockview-theme.css";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Group, Panel, Separator, usePanelRef, type PanelSize } from "react-resizable-panels";

import type { WorkspaceTab } from "@/features/workspace";

import { useWorkbenchHotkeys } from "../hooks/useWorkbenchHotkeys";
import { scheduleLayoutSave } from "../lib/docks";
import type { SavedLayout } from "../lib/layout";
import { restoreWorkbench } from "../lib/restore";
import { useWorkbenchStore } from "../store/workbench";
import type { WorkbenchModule } from "../types";
import { ActivityBar } from "./ActivityBar";
import { DocumentDock } from "./DocumentDock";
import { ModuleDock } from "./ModuleDock";

/** Sidebar (module dock) limits. */
const SIDEBAR_MIN = "180px";
const SIDEBAR_MAX = "60%";

interface WorkbenchProps {
  /** Every module, in activity bar order. */
  modules: readonly WorkbenchModule[];
  /** Module dock arrangement on first start and after "Reset layout". */
  defaultModuleLayout: readonly (readonly string[])[];
  /** Renders a tab's content; the app shell maps tab kinds to feature views. */
  renderTab: (tab: WorkspaceTab) => ReactNode;
  /** The layout saved by the previous session. */
  saved: SavedLayout | null;
  /** Buttons at the bottom of the activity bar. */
  activityBarFooter?: ReactNode;
}

/**
 * The main window's frame: activity bar, module dock (sidebar) and document dock. Knows nothing
 * about what modules and tabs show; the app shell passes them in.
 */
export function Workbench(props: WorkbenchProps) {
  const { modules, defaultModuleLayout, renderTab, saved, activityBarFooter } = props;
  // Runs once, during the first render, so restored tabs exist before anything reads them.
  const [restored] = useState(() => restoreWorkbench(saved));
  const epoch = useWorkbenchStore((state) => state.layoutEpoch);
  const collapsed = useWorkbenchStore((state) => state.sidebarCollapsed);
  // Read once per layout: react-resizable-panels re-registers a panel whenever `defaultSize`
  // changes, which would reset the splitter on every drag step if it followed the store.
  const initialSidebar = useMemo(() => {
    const { sidebarCollapsed, sidebarWidthPx } = useWorkbenchStore.getState();
    return sidebarCollapsed ? 0 : `${sidebarWidthPx}px`;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recomputed only for a new layout
  }, [epoch]);
  const layout = epoch === 0 ? restored : null;
  const sidebar = usePanelRef();
  useWorkbenchHotkeys(modules);

  useEffect(() => {
    const panel = sidebar.current;
    if (!panel) return;
    if (collapsed && !panel.isCollapsed()) panel.collapse();
    if (!collapsed && panel.isCollapsed()) panel.expand();
  }, [collapsed, sidebar, epoch]);

  const onSidebarResize = (size: PanelSize): void => {
    const { setSidebarCollapsed, setSidebarWidth } = useWorkbenchStore.getState();
    if (size.inPixels <= 0) {
      setSidebarCollapsed(true);
    } else {
      setSidebarCollapsed(false);
      setSidebarWidth(Math.round(size.inPixels));
    }
    scheduleLayoutSave();
  };

  return (
    <div className="flex min-h-0 flex-1">
      <ActivityBar modules={modules} footer={activityBarFooter} />
      <Group key={epoch} orientation="horizontal" className="min-w-0 flex-1">
        <Panel
          id="modules"
          panelRef={sidebar}
          collapsible
          collapsedSize={0}
          defaultSize={initialSidebar}
          minSize={SIDEBAR_MIN}
          maxSize={SIDEBAR_MAX}
          onResize={onSidebarResize}
        >
          <section
            aria-label="Modules"
            data-workbench-region="modules"
            inert={collapsed}
            className="h-full"
          >
            <ModuleDock
              modules={modules}
              defaultLayout={defaultModuleLayout}
              saved={layout?.modules ?? null}
            />
          </section>
        </Panel>
        <Separator
          aria-label="Resize sidebar"
          className="w-px bg-border outline-none hover:bg-primary focus-visible:bg-ring data-[separator=active]:bg-primary"
        />
        <Panel id="documents" className="min-w-0">
          <main aria-label="Tabs" data-workbench-region="documents" className="h-full min-h-0">
            <DocumentDock key={epoch} renderTab={renderTab} saved={layout?.documents ?? null} />
          </main>
        </Panel>
      </Group>
    </div>
  );
}

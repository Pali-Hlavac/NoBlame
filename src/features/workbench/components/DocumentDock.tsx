import {
  DockviewReact,
  type DockviewApi,
  type DockviewReadyEvent,
  type IDockviewPanelProps,
  type SerializedDockview,
} from "dockview-react";
import { LayoutGridIcon } from "lucide-react";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import { WELCOME_TAB, useTabsStore, type WorkspaceTab } from "@/features/workspace";
import { EmptyState } from "@/shared/components/EmptyState";
import { Button } from "@/shared/ui/button";

import { docks, scheduleLayoutSave } from "../lib/docks";
import type { DocumentParams } from "../lib/layout";
import { DOCUMENT_COMPONENT, reconcileDocuments } from "../lib/reconcile";
import { DOCK_THEME } from "../lib/theme";

type RenderTab = (tab: WorkspaceTab) => ReactNode;

const RenderTabContext = createContext<RenderTab>(() => null);

/**
 * Renders a tab's content once the tab has been shown, then keeps it mounted. Restored tabs in
 * the background therefore do not open their repositories until the user looks at them.
 */
function DocumentPanel({ params, api }: IDockviewPanelProps<DocumentParams>) {
  const renderTab = useContext(RenderTabContext);
  const tab = useTabsStore((state) => state.tabs.find((open) => open.id === api.id)) ?? params.tab;
  const [shown, setShown] = useState(api.isVisible);
  useEffect(() => {
    if (shown) return;
    const subscription = api.onDidVisibilityChange((event) => {
      if (event.isVisible) setShown(true);
    });
    return () => {
      subscription.dispose();
    };
  }, [api, shown]);
  return (
    // Content scrolls itself; a scrolling wrapper flashes scrollbars while the dock resizes.
    <div className="h-full overflow-hidden">{shown ? renderTab(tab) : null}</div>
  );
}

function DocumentWatermark() {
  return (
    <EmptyState
      icon={LayoutGridIcon}
      title="No open tabs"
      className="h-full"
      action={
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            useTabsStore.getState().openTab(WELCOME_TAB);
          }}
        >
          Open Welcome tab
        </Button>
      }
    />
  );
}

const COMPONENTS = { [DOCUMENT_COMPONENT]: DocumentPanel };

/**
 * Connects dockview and the tabs store both ways. Store changes are reconciled into the dock;
 * the user's clicks and closes in the dock are written back to the store. Events caused by
 * reconciling itself are ignored, so the two never ping-pong.
 */
function connect(api: DockviewApi): () => void {
  let reconciling = false;
  const sync = (): void => {
    if (reconciling) return;
    reconciling = true;
    try {
      const { tabs, activeTabId, activeRepositoryTabId } = useTabsStore.getState();
      reconcileDocuments(api, tabs, activeTabId, activeRepositoryTabId);
    } finally {
      reconciling = false;
    }
  };
  sync();
  const unsubscribe = useTabsStore.subscribe(sync);
  const subscriptions = [
    api.onDidActivePanelChange((event) => {
      const store = useTabsStore.getState();
      if (!reconciling && event.panel && event.panel.id !== store.activeTabId) {
        store.activateTab(event.panel.id);
      }
    }),
    api.onDidRemovePanel((panel) => {
      if (!reconciling) useTabsStore.getState().closeTab(panel.id, api.activePanel?.id ?? null);
    }),
    api.onDidLayoutChange(scheduleLayoutSave),
  ];
  return () => {
    unsubscribe();
    subscriptions.forEach((subscription) => {
      subscription.dispose();
    });
  };
}

interface DocumentDockProps {
  renderTab: RenderTab;
  /** Arrangement saved by the previous session (its tabs are already in the store). */
  saved: SerializedDockview | null;
}

/** The main dock: repository tabs and the diff tab, splittable in every direction. */
export function DocumentDock({ renderTab, saved }: DocumentDockProps) {
  const disconnect = useRef<(() => void) | null>(null);

  useEffect(
    () => () => {
      disconnect.current?.();
      disconnect.current = null;
      docks.documents = null;
    },
    [],
  );

  const onReady = ({ api }: DockviewReadyEvent): void => {
    docks.documents = api;
    try {
      if (saved) api.fromJSON(saved);
    } catch (error) {
      console.warn("Ignoring the saved tab layout", error);
      api.clear();
    }
    disconnect.current = connect(api);
  };

  return (
    <RenderTabContext.Provider value={renderTab}>
      <DockviewReact
        className="h-full"
        theme={DOCK_THEME}
        components={COMPONENTS}
        watermarkComponent={DocumentWatermark}
        disableFloatingGroups
        onReady={onReady}
      />
    </RenderTabContext.Provider>
  );
}

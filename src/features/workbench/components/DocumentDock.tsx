import {
  DockviewReact,
  type DockviewApi,
  type DockviewReadyEvent,
  type IDockviewPanelProps,
  type SerializedDockview,
} from "dockview-react";
import { LayoutGridIcon } from "lucide-react";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import {
  WELCOME_TAB,
  setCloseFallback,
  useTabsStore,
  type WorkspaceTab,
} from "@/features/workspace";
import { EmptyState } from "@/shared/components/EmptyState";
import { Button } from "@/shared/ui/button";

import { docks, scheduleLayoutSave } from "../lib/docks";
import type { DocumentParams } from "../lib/layout";
import { nextActiveAfterClose } from "../lib/nextActive";
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
    <div className="relative h-full overflow-hidden">{shown ? renderTab(tab) : null}</div>
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
  setCloseFallback((closedId) =>
    nextActiveAfterClose(api, closedId, useTabsStore.getState().recent),
  );
  const subscriptions = [
    api.onDidActivePanelChange((event) => {
      const store = useTabsStore.getState();
      if (!reconciling && event.panel && event.panel.id !== store.activeTabId) {
        store.activateTab(event.panel.id);
      }
    }),
    api.onDidRemovePanel((panel) => {
      if (reconciling) return;
      // Closed in the dock (its ×, middle click): the dock already showed the next tab of the
      // group by its own order, which forgets what was used when groups change; choose by ours.
      const store = useTabsStore.getState();
      store.closeTab(panel.id, nextActiveAfterClose(api, panel.id, store.recent, panel.group));
    }),
    api.onDidLayoutChange(scheduleLayoutSave),
  ];
  return () => {
    unsubscribe();
    setCloseFallback(null);
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
  const [api, setApi] = useState<DockviewApi | null>(null);

  // Connected in an effect, not in `onReady`: React may run effects again without a new dock
  // (hot reload, StrictMode), and the store must then be connected again, not left behind.
  useEffect(() => {
    if (!api) return;
    docks.documents = api;
    const disconnect = connect(api);
    return () => {
      disconnect();
      if (docks.documents === api) docks.documents = null;
    };
  }, [api]);

  const onReady = ({ api: ready }: DockviewReadyEvent): void => {
    docks.documents = ready;
    try {
      if (saved) ready.fromJSON(saved);
    } catch (error) {
      console.warn("Ignoring the saved tab layout", error);
      ready.clear();
    }
    setApi(ready);
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

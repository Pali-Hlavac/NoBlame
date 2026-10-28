import type { ReactNode } from "react";

import { RepositoryView } from "@/features/repositories";
import { SettingsView } from "@/features/settings";
import type { WorkspaceTab } from "@/features/workspace";

import { WelcomeTabContent } from "./WelcomeTabContent";

/** Maps a workspace tab to the feature view that renders it. */
export function renderTab(tab: WorkspaceTab): ReactNode {
  switch (tab.kind) {
    case "welcome":
      return <WelcomeTabContent />;
    case "repository":
      return <RepositoryView key={tab.id} tab={tab} />;
    case "settings":
      return <SettingsView />;
  }
}

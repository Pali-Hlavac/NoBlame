import type { ReactNode } from "react";

import { BlameView } from "@/features/blame";
import { CompareView } from "@/features/compare";
import { DiffView } from "@/features/diff";
import { FileView } from "@/features/files";
import { HistoryView } from "@/features/history";
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
    case "diff":
      return <DiffView />;
    case "file":
      return <FileView />;
    case "history":
      return <HistoryView />;
    case "blame":
      return <BlameView />;
    case "compare":
      return <CompareView />;
  }
}

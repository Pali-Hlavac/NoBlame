import { SearchIcon } from "lucide-react";
import { Group, Panel, Separator } from "react-resizable-panels";

import { CommandPalette, PALETTE_HOTKEY, usePaletteStore } from "@/features/command-palette";
import { RepositoryList, openRepositories } from "@/features/repositories";
import { useRepositoryRequests } from "@/features/windows";
import { WorkspaceView } from "@/features/workspace";
import { formatHotkey } from "@/shared/lib/hotkeys";
import { isMacPlatform } from "@/shared/lib/platform";
import { Button } from "@/shared/ui/button";
import { Tooltip } from "@/shared/ui/tooltip";

import { useAppCommands } from "../commands/useAppCommands";
import { renderTab } from "./renderTab";
import { StatusBar } from "./StatusBar";

/** Sidebar size limits, relative to the window width. */
const SIDEBAR_SIZE = { default: "20%", min: "12%", max: "40%" } as const;

/** Main window chrome: resizable sidebar, repository tabs, status bar and command palette. */
export function MainWindow() {
  const commands = useAppCommands();
  useRepositoryRequests(openRepositories);
  const paletteLabel = `Command palette (${formatHotkey(PALETTE_HOTKEY, isMacPlatform())})`;
  const openPalette = (
    <Tooltip content={paletteLabel}>
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        aria-label={paletteLabel}
        onClick={() => {
          usePaletteStore.getState().setOpen(true);
        }}
      >
        <SearchIcon aria-hidden />
      </Button>
    </Tooltip>
  );

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <Group orientation="horizontal" className="min-h-0 flex-1">
        <Panel
          id="sidebar"
          defaultSize={SIDEBAR_SIZE.default}
          minSize={SIDEBAR_SIZE.min}
          maxSize={SIDEBAR_SIZE.max}
          className="bg-muted/30"
        >
          <RepositoryList />
        </Panel>
        <Separator
          aria-label="Resize sidebar"
          className="w-px bg-border outline-none hover:bg-primary focus-visible:bg-ring data-[separator=active]:bg-primary"
        />
        <Panel id="workspace" className="min-w-0">
          <main className="h-full">
            <WorkspaceView renderTab={renderTab} tabBarActions={openPalette} />
          </main>
        </Panel>
      </Group>
      <StatusBar />
      <CommandPalette commands={commands} />
    </div>
  );
}

import { SearchIcon } from "lucide-react";

import { PALETTE_HOTKEY, usePaletteStore } from "@/features/command-palette";
import { ActiveRepositoryStatus } from "@/features/repositories";
import { TitleBar } from "@/features/window-frame";
import { WorkbenchToolbar } from "@/features/workbench";
import { formatHotkey } from "@/shared/lib/hotkeys";
import { isMacPlatform } from "@/shared/lib/platform";
import { Button } from "@/shared/ui/button";
import { Tooltip } from "@/shared/ui/tooltip";

import { TOOLBAR_ACTIONS } from "../workbench/toolbar";

/**
 * The main window's title bar: repository actions on the left, the active repository with its
 * branch and the command palette button on the right, then the window buttons.
 */
export function MainTitleBar() {
  const paletteLabel = `Command palette (${formatHotkey(PALETTE_HOTKEY, isMacPlatform())})`;
  return (
    <TitleBar
      start={<WorkbenchToolbar actions={TOOLBAR_ACTIONS} />}
      end={
        <>
          <ActiveRepositoryStatus />
          <Tooltip content={paletteLabel}>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0"
              aria-label={paletteLabel}
              onClick={() => {
                usePaletteStore.getState().setOpen(true);
              }}
            >
              <SearchIcon aria-hidden />
            </Button>
          </Tooltip>
        </>
      }
    />
  );
}

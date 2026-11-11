import { SearchIcon } from "lucide-react";

import { usePaletteStore } from "@/features/command-palette";
import { ActiveRepositoryStatus } from "@/features/repositories";
import { TitleBar } from "@/features/window-frame";
import { WorkbenchToolbar } from "@/features/workbench";
import { useKeys } from "@/shared/hooks/useKeys";
import { withHotkey } from "@/shared/lib/hotkeys";
import { isMacPlatform } from "@/shared/lib/platform";
import { Button } from "@/shared/ui/button";
import { Tooltip } from "@/shared/ui/tooltip";

import { useToolbarActions } from "../workbench/toolbar";

/**
 * The main window's title bar: repository actions on the left, the active repository with its
 * branch and the command palette button on the right, then the window buttons.
 */
export function MainTitleBar() {
  const actions = useToolbarActions();
  const paletteLabel = withHotkey("Command palette", useKeys("palette.open"), isMacPlatform());
  return (
    <TitleBar
      start={<WorkbenchToolbar actions={actions} />}
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

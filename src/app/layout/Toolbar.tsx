import { SearchIcon } from "lucide-react";

import { PALETTE_HOTKEY, usePaletteStore } from "@/features/command-palette";
import { formatHotkey } from "@/shared/lib/hotkeys";
import { isMacPlatform } from "@/shared/lib/platform";
import { Button } from "@/shared/ui/button";
import { Tooltip } from "@/shared/ui/tooltip";

/** Bar above the tabs: actions for the active repository (M2.5) and the palette button. */
export function Toolbar() {
  const paletteLabel = `Command palette (${formatHotkey(PALETTE_HOTKEY, isMacPlatform())})`;
  return (
    <div
      role="toolbar"
      aria-label="Repository actions"
      data-workbench-region="toolbar"
      className="flex h-9 shrink-0 items-center gap-1 border-b border-border bg-muted/40 px-2"
    >
      <div className="flex-1" />
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
    </div>
  );
}

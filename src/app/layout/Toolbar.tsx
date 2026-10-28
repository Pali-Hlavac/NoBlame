import {
  ArchiveIcon,
  ArrowDownToLineIcon,
  ArrowUpFromLineIcon,
  GitCommitVerticalIcon,
  RefreshCwIcon,
  ScissorsIcon,
  SearchIcon,
} from "lucide-react";

import { PALETTE_HOTKEY, usePaletteStore } from "@/features/command-palette";
import { ActiveRepositoryStatus } from "@/features/repositories";
import { WorkbenchToolbar, openModule, type ToolbarAction } from "@/features/workbench";
import { formatHotkey } from "@/shared/lib/hotkeys";
import { isMacPlatform } from "@/shared/lib/platform";
import { Button } from "@/shared/ui/button";
import { Tooltip } from "@/shared/ui/tooltip";

import { MODULES } from "../workbench/modules";

/** Milestones that deliver the stubbed actions (docs/roadmap.md). */
const REMOTE_MILESTONE = "M5";
const COMMIT_MILESTONE = "M4";

const STASHES_MODULE = MODULES.find((module) => module.id === "stashes");

/** Toolbar buttons for the active repository, left to right. */
const ACTIONS: readonly ToolbarAction[] = [
  {
    id: "pull",
    label: "Pull",
    icon: ArrowDownToLineIcon,
    milestone: REMOTE_MILESTONE,
    menu: [
      { id: "pull", label: "Pull", icon: ArrowDownToLineIcon, milestone: REMOTE_MILESTONE },
      { id: "fetch", label: "Fetch", icon: RefreshCwIcon, milestone: REMOTE_MILESTONE },
      {
        id: "fetch-all",
        label: "Fetch all remotes",
        icon: RefreshCwIcon,
        milestone: REMOTE_MILESTONE,
      },
      {
        id: "fetch-prune",
        label: "Fetch and prune",
        icon: ScissorsIcon,
        milestone: REMOTE_MILESTONE,
      },
    ],
  },
  { id: "push", label: "Push", icon: ArrowUpFromLineIcon, milestone: REMOTE_MILESTONE },
  { id: "commit", label: "Commit", icon: GitCommitVerticalIcon, milestone: COMMIT_MILESTONE },
  {
    id: "stashes",
    label: "Stashes",
    icon: ArchiveIcon,
    run: STASHES_MODULE
      ? () => {
          openModule(STASHES_MODULE);
        }
      : undefined,
  },
];

/** Bar above the tabs: actions for the active repository, its branch and the palette button. */
export function Toolbar() {
  const paletteLabel = `Command palette (${formatHotkey(PALETTE_HOTKEY, isMacPlatform())})`;
  return (
    <WorkbenchToolbar
      actions={ACTIONS}
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

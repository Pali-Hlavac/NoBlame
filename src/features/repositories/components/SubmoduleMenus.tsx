import { CopyIcon, DownloadIcon, EllipsisIcon, RefreshCwIcon } from "lucide-react";
import type { ReactNode } from "react";

import { useAppSettings } from "@/features/settings";
import type { SubmoduleDto } from "@/shared/ipc/bindings";
import { copyToClipboard } from "@/shared/lib/clipboard";
import { KIND_ICON_CLASSES } from "@/shared/lib/workKinds";
import { Button } from "@/shared/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/shared/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";

import { useSubmoduleUpdate } from "../hooks/useSubmoduleUpdate";

const ICON = KIND_ICON_CLASSES.submodules;

/** "Initialize" for a submodule not cloned yet, else "Update" (to the recorded commit). */
function updateLabel(submodule: SubmoduleDto): string {
  return submodule.initialized ? "Update to the recorded commit" : "Initialize";
}

interface SubmoduleMenuProps {
  submodule: SubmoduleDto;
  /** The repository it is in (its work tree). */
  parent: string;
}

/** Right-click menu of a submodule row: initialize or update it, copy its path. */
export function SubmoduleContextMenu({
  submodule,
  parent,
  children,
}: SubmoduleMenuProps & { children: ReactNode }) {
  const update = useSubmoduleUpdate();
  const Icon = submodule.initialized ? RefreshCwIcon : DownloadIcon;
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent aria-label={`Actions for ${submodule.path}`}>
        <ContextMenuItem
          onSelect={() => {
            update(parent, [submodule], false);
          }}
        >
          <Icon className={ICON} aria-hidden />
          {updateLabel(submodule)}
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => {
            copyToClipboard(submodule.workDir, "Path");
          }}
        >
          <CopyIcon aria-hidden />
          Copy path
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

/** The update entry of an initialized submodule's "…" menu. */
export function SubmoduleUpdateItem({ submodule, parent }: SubmoduleMenuProps) {
  const update = useSubmoduleUpdate();
  return (
    <DropdownMenuItem
      onSelect={() => {
        update(parent, [submodule], false);
      }}
    >
      <RefreshCwIcon className={ICON} aria-hidden />
      {updateLabel(submodule)}
    </DropdownMenuItem>
  );
}

/** The "…" button of a submodule that is not initialized: only Initialize applies. */
export function UninitializedSubmoduleActions({ submodule, parent }: SubmoduleMenuProps) {
  const update = useSubmoduleUpdate();
  const show = useAppSettings().repositories.showActionsMenu;
  if (!show) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="mr-1 size-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
          aria-label={`Actions for ${submodule.path}`}
        >
          <EllipsisIcon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem
          onSelect={() => {
            update(parent, [submodule], false);
          }}
        >
          <DownloadIcon className={ICON} aria-hidden />
          Initialize
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** "Update all submodules" in a repository's "…" menu (shown when it has submodules). */
export function UpdateAllSubmodulesItem({
  path,
  submodules,
}: {
  path: string;
  submodules: readonly SubmoduleDto[];
}) {
  const update = useSubmoduleUpdate();
  if (submodules.length === 0) return null;
  return (
    <DropdownMenuItem
      onSelect={() => {
        update(path, submodules, true);
      }}
    >
      <RefreshCwIcon className={ICON} aria-hidden />
      Update all submodules
    </DropdownMenuItem>
  );
}

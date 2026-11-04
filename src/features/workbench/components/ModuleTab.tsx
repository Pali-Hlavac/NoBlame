import { DockviewDefaultTab, type IDockviewPanelHeaderProps } from "dockview-react";
import { PictureInPicture2Icon, XIcon } from "lucide-react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/shared/ui/context-menu";

import { popOutModule } from "../lib/popups";

/** A module's tab in the dock, with a right-click menu to pop the module out or close it. */
export function ModuleTab(props: IDockviewPanelHeaderProps) {
  const { api } = props;
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {/* `contents`: the dock lays out the tab itself; this only catches the right-click. */}
        <div className="contents">
          <DockviewDefaultTab {...props} />
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          onSelect={() => {
            popOutModule(api.id);
          }}
        >
          <PictureInPicture2Icon aria-hidden />
          Pop out
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => {
            api.close();
          }}
        >
          <XIcon aria-hidden />
          Close
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

import { DockviewDefaultTab, type IDockviewPanelHeaderProps } from "dockview-react";
import { PictureInPicture2Icon, XIcon } from "lucide-react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/shared/ui/context-menu";

import { popOutModule } from "../lib/popups";
import { idsOfStackPanel, isStackPanelId } from "../lib/stacks";
import { StackMenuItems } from "./StackMenuItems";

/**
 * A module's tab in the dock, with a right-click menu: stack it with another module (or change
 * or end its stack), pop it out (not a stack), close it.
 */
export function ModuleTab(props: IDockviewPanelHeaderProps) {
  const { api } = props;
  const stacked = isStackPanelId(api.id);
  const [moduleId = api.id] = stacked ? idsOfStackPanel(api.id) : [api.id];
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {/* `contents`: the dock lays out the tab itself; this only catches the right-click. */}
        <div className="contents">
          <DockviewDefaultTab {...props} />
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <StackMenuItems moduleId={moduleId} />
        <ContextMenuSeparator />
        {!stacked && (
          <ContextMenuItem
            onSelect={() => {
              popOutModule(api.id);
            }}
          >
            <PictureInPicture2Icon aria-hidden />
            Pop out
          </ContextMenuItem>
        )}
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

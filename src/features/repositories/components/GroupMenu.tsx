import {
  ArrowDownIcon,
  ArrowUpIcon,
  EllipsisIcon,
  FolderOpenIcon,
  PencilIcon,
  Trash2Icon,
  type LucideIcon,
} from "lucide-react";
import { Fragment, type ReactNode } from "react";

import { Button } from "@/shared/ui/button";
import { kindIconClass, type WorkKind } from "@/shared/lib/workKinds";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/shared/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";

/** An entry of a group's menu. */
export interface GroupMenuEntry {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Colours the icon. */
  kind?: WorkKind;
  onSelect?: () => void;
  /** Set for stubs: the milestone that delivers the entry. */
  milestone?: string;
  disabled?: boolean;
  /** Draws a separator above the entry. */
  startsSection?: boolean;
}

type Entry = GroupMenuEntry;

export interface GroupMenuActions {
  /** Whether the group holds repositories (Open all needs some). */
  hasRepositories: boolean;
  /** Entries after Open all, supplied by the app shell (Pull all, Push all). */
  forAll: readonly GroupMenuEntry[];
  canMoveUp: boolean;
  canMoveDown: boolean;
  onOpenAll: () => void;
  onRename: () => void;
  onMove: (offset: number) => void;
  onDelete: () => void;
}

function entries(actions: GroupMenuActions): Entry[] {
  return [
    {
      id: "open-all",
      label: "Open all",
      icon: FolderOpenIcon,
      kind: "repositories",
      onSelect: actions.onOpenAll,
      disabled: !actions.hasRepositories,
    },
    ...actions.forAll,
    {
      id: "rename",
      label: "Rename",
      icon: PencilIcon,
      onSelect: actions.onRename,
      startsSection: true,
    },
    {
      id: "move-up",
      label: "Move up",
      icon: ArrowUpIcon,
      onSelect: () => {
        actions.onMove(-1);
      },
      disabled: !actions.canMoveUp,
    },
    {
      id: "move-down",
      label: "Move down",
      icon: ArrowDownIcon,
      onSelect: () => {
        actions.onMove(1);
      },
      disabled: !actions.canMoveDown,
    },
    {
      id: "delete",
      label: "Delete group…",
      icon: Trash2Icon,
      onSelect: actions.onDelete,
      startsSection: true,
    },
  ];
}

/** An entry's contents: icon, label and the milestone of a stub. */
function EntryLabel({ entry }: { entry: Entry }) {
  const Icon = entry.icon;
  return (
    <>
      <Icon className={kindIconClass(entry.kind)} aria-hidden />
      <span className="flex-1">{entry.label}</span>
      {entry.milestone && <span className="text-xs text-muted-foreground">{entry.milestone}</span>}
    </>
  );
}

const isDisabled = (entry: Entry): boolean =>
  entry.disabled === true || entry.milestone !== undefined;

/** The "…" button of a group row. */
export function GroupActionsButton({ name, actions }: { name: string; actions: GroupMenuActions }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="mr-1 size-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
          aria-label={`Actions for the group ${name}`}
        >
          <EllipsisIcon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {entries(actions).map((entry) => (
          <Fragment key={entry.id}>
            {entry.startsSection && <DropdownMenuSeparator />}
            <DropdownMenuItem disabled={isDisabled(entry)} onSelect={entry.onSelect}>
              <EntryLabel entry={entry} />
            </DropdownMenuItem>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The same entries on right-click of the group row (`children`). */
export function GroupContextMenu({
  actions,
  children,
}: {
  actions: GroupMenuActions;
  children: ReactNode;
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        {entries(actions).map((entry) => (
          <Fragment key={entry.id}>
            {entry.startsSection && <ContextMenuSeparator />}
            <ContextMenuItem disabled={isDisabled(entry)} onSelect={entry.onSelect}>
              <EntryLabel entry={entry} />
            </ContextMenuItem>
          </Fragment>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  );
}

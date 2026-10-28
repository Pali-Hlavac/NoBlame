import { EllipsisIcon } from "lucide-react";
import { Fragment, useContext } from "react";

import { useAppSettings } from "@/features/settings";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";

import { RepositoryActionsContext, type RepositoryTarget } from "../lib/actions";

/** The "…" button of a repository row: shown on hover or focus, opens the actions menu. */
export function RepositoryActionsMenu({ repository }: { repository: RepositoryTarget }) {
  const actions = useContext(RepositoryActionsContext);
  if (actions.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="mr-1 size-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
          aria-label={`Actions for ${repository.title}`}
        >
          <EllipsisIcon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {actions.map((action, index) => {
          const Icon = action.icon;
          const stub = action.milestone !== undefined || !action.run;
          return (
            <Fragment key={action.id}>
              {action.group === "start" && index > 0 && <DropdownMenuSeparator />}
              <DropdownMenuItem
                disabled={stub}
                onSelect={() => {
                  if (!stub) action.run?.(repository);
                }}
              >
                <Icon aria-hidden />
                <span className="flex-1">{action.label}</span>
                {action.milestone && (
                  <span className="text-xs text-muted-foreground">{action.milestone}</span>
                )}
              </DropdownMenuItem>
            </Fragment>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The "…" menu of an open repository, unless switched off in Settings. */
export function OpenRepositoryActions({ repository }: { repository: RepositoryTarget }) {
  const show = useAppSettings().repositories.showActionsMenu;
  return show ? <RepositoryActionsMenu repository={repository} /> : null;
}

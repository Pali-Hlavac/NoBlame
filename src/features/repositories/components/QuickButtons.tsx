import { LoaderCircleIcon, type LucideIcon } from "lucide-react";
import { useContext } from "react";

import { useJobRunning } from "@/features/jobs";
import { useAppSettings } from "@/features/settings";
import type { JobKindDto, RepositoryButton } from "@/shared/ipc/bindings";
import { cn } from "@/shared/lib/cn";
import { kindIconClass, type WorkKind } from "@/shared/lib/workKinds";
import { Button } from "@/shared/ui/button";

import {
  GroupActionsContext,
  RepositoryActionsContext,
  actionsFor,
  type GroupTarget,
  type RepositoryTarget,
} from "../lib/actions";

/** Where a button without a job looks for one: nowhere, so it never spins. */
const NO_PATHS: readonly string[] = [];

interface QuickButtonProps {
  /** Its accessible name and tooltip (`Pull api`). */
  label: string;
  icon: LucideIcon;
  kind: WorkKind | undefined;
  /** Where its job runs; it spins while a job of kind `job` runs on any of them. */
  paths: readonly string[];
  job: JobKindDto | undefined;
  disabled?: boolean;
  onClick: () => void;
}

/** A small icon button on a row: shown on hover or focus, and while its job runs. */
function QuickButton({ label, icon: Icon, kind, paths, job, disabled, onClick }: QuickButtonProps) {
  const running = useJobRunning(job === undefined ? NO_PATHS : paths, job ?? "pull");
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        "size-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
        running && "opacity-100",
      )}
      aria-label={running ? `${label} (running)` : label}
      title={running ? `${label} (running)` : label}
      disabled={disabled === true || running}
      onClick={onClick}
    >
      {running ? (
        <LoaderCircleIcon className="animate-spin" aria-hidden />
      ) : (
        <Icon className={kindIconClass(kind)} aria-hidden />
      )}
    </Button>
  );
}

/** Whether Settings → Repositories shows `button`. */
function useShown(): (button: RepositoryButton | undefined) => boolean {
  const buttons = useAppSettings().repositories.buttons;
  return (button) => button !== undefined && buttons.includes(button);
}

/** A repository row's quick buttons (Pull, Push), as chosen in Settings. */
export function RepositoryQuickButtons({ repository }: { repository: RepositoryTarget }) {
  const shown = useShown();
  const actions = actionsFor(useContext(RepositoryActionsContext), repository).filter(
    (action) => action.run !== undefined && action.milestone === undefined && shown(action.button),
  );
  return actions.map((action) => (
    <QuickButton
      key={action.id}
      label={`${action.label} ${repository.title}`}
      icon={action.icon}
      kind={action.kind}
      paths={[repository.path]}
      job={action.job}
      onClick={() => {
        action.run?.(repository);
      }}
    />
  ));
}

/** A group row's quick buttons (Pull all, Push all), as chosen in Settings. */
export function GroupQuickButtons({ group }: { group: GroupTarget }) {
  const shown = useShown();
  const actions = useContext(GroupActionsContext).filter((action) => shown(action.button));
  return actions.map((action) => (
    <QuickButton
      key={action.id}
      label={`${action.label} in ${group.name}`}
      icon={action.icon}
      kind={action.kind}
      paths={group.paths}
      job={action.job}
      disabled={group.paths.length === 0}
      onClick={() => {
        action.run(group);
      }}
    />
  ));
}

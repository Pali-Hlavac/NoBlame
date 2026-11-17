import { AppWindowIcon, type LucideIcon } from "lucide-react";
import { toast } from "sonner";

import { openInMainWindow } from "@/features/windows";
import { toIpcError } from "@/shared/ipc/client";
import { Button } from "@/shared/ui/button";

/** Shows the repository at `folder` in the main window (opening it there). */
export function OpenInNoBlameButton({
  folder,
  variant = "default",
}: {
  folder: string;
  variant?: "default" | "outline";
}) {
  return (
    <Button
      type="button"
      variant={variant}
      onClick={() => {
        openInMainWindow(folder).catch((error: unknown) => {
          const { message, hint } = toIpcError(error);
          toast.error(message, { description: hint ?? undefined });
        });
      }}
    >
      <AppWindowIcon aria-hidden />
      Open in NoBlame
    </Button>
  );
}

interface TaskDoneProps {
  title: string;
  /** The new repository. */
  folder: string;
  icon: LucideIcon;
  againLabel: string;
  onAgain: () => void;
}

/** After a Clone or Create repository window did its work: where, and what next. */
export function TaskDone({ title, folder, icon: Icon, againLabel, onAgain }: TaskDoneProps) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Icon aria-hidden className="size-5 text-kind-commit" />
        {title}
      </h2>
      <p className="font-mono text-sm break-all select-text">{folder}</p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onAgain}>
          {againLabel}
        </Button>
        <OpenInNoBlameButton folder={folder} />
      </div>
    </section>
  );
}

import { useAppInfo } from "@/features/about";
import { PALETTE_HOTKEY, usePaletteStore } from "@/features/command-palette";
import { GitStatusButton } from "@/features/git-env";
import { JobsIndicator } from "@/features/jobs";
import { ThemeMenu } from "@/features/settings";
import { LoaderCircleIcon } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Kbd } from "@/shared/ui/kbd";

import { useWork } from "./useWork";
import { WorkStrip } from "./WorkStrip";

/**
 * Bottom bar: the app version (or the change running) on the left; jobs, git status, palette hint
 * and theme on the right; a moving strip along its top while anything runs.
 */
export function StatusBar() {
  const { data: info } = useAppInfo();
  const work = useWork();
  return (
    <footer className="relative flex h-7 shrink-0 items-center justify-between border-t border-border bg-muted/40 px-2 text-xs text-muted-foreground">
      <WorkStrip {...work} />
      {work.action === null ? (
        <span>{info ? `${info.name} ${info.version}` : " "}</span>
      ) : (
        <span role="status" className="flex min-w-0 items-center gap-1.5 text-foreground">
          <LoaderCircleIcon className="size-3.5 shrink-0 animate-spin" aria-hidden />
          <span className="truncate">{work.action}…</span>
        </span>
      )}
      <div className="flex items-center gap-1">
        <JobsIndicator />
        <GitStatusButton />
        <Button
          variant="ghost"
          size="sm"
          className="h-6 gap-1.5 px-2 text-xs"
          onClick={() => {
            usePaletteStore.getState().setOpen(true);
          }}
        >
          Commands <Kbd combo={PALETTE_HOTKEY} />
        </Button>
        <ThemeMenu />
      </div>
    </footer>
  );
}

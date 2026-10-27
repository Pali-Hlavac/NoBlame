import { FolderOpenIcon } from "lucide-react";

import { PALETTE_HOTKEY } from "@/features/command-palette";
import { GitNotice } from "@/features/git-env";
import { useOpenRepository } from "@/features/repositories";
import { WelcomeView } from "@/features/workspace";
import { Button } from "@/shared/ui/button";

/** The Welcome tab: git problems first, then "Open repository" and the shortcuts. */
export function WelcomeTabContent() {
  const openRepository = useOpenRepository();
  return (
    <WelcomeView
      paletteHotkey={PALETTE_HOTKEY}
      notice={<GitNotice className="w-full" />}
      actions={
        <Button onClick={() => void openRepository()}>
          <FolderOpenIcon aria-hidden />
          Open repository…
        </Button>
      }
    />
  );
}

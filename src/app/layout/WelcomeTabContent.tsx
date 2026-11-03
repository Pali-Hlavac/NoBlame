import { FolderOpenIcon, FolderPlusIcon } from "lucide-react";

import { PALETTE_HOTKEY } from "@/features/command-palette";
import { GitNotice } from "@/features/git-env";
import {
  RecentRepositories,
  useCreateRepository,
  useOpenRepository,
} from "@/features/repositories";
import { WelcomeView } from "@/features/workspace";
import { Button } from "@/shared/ui/button";
import { KIND_ICON_CLASSES } from "@/shared/lib/workKinds";

/** The Welcome tab (dashboard): git problems first, then open/create and recent repositories. */
export function WelcomeTabContent() {
  const openRepository = useOpenRepository();
  const createRepository = useCreateRepository();
  return (
    <div className="h-full overflow-auto">
      <WelcomeView
        paletteHotkey={PALETTE_HOTKEY}
        notice={<GitNotice className="w-full" />}
        actions={
          <>
            <Button onClick={() => void openRepository()}>
              <FolderOpenIcon aria-hidden />
              Open repository…
            </Button>
            <Button
              variant="outline"
              disabled={createRepository.pending}
              onClick={() => void createRepository.create()}
            >
              <FolderPlusIcon className={KIND_ICON_CLASSES.repositories} aria-hidden />
              Create repository…
            </Button>
          </>
        }
      >
        <RecentRepositories />
      </WelcomeView>
    </div>
  );
}

import { open } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";

import { useTabsStore } from "@/features/workspace";

import { useInitRepository } from "../api/mutations";
import { repositoryTab } from "../lib/path";

/** Opens a tab for each path (focusing the last one). */
export function openRepositories(paths: readonly string[]): void {
  const { openTab } = useTabsStore.getState();
  for (const path of paths) openTab(repositoryTab(path));
}

async function pickFolder(title: string): Promise<string | null> {
  try {
    const path = await open({ directory: true, title });
    return typeof path === "string" ? path : null;
  } catch (error) {
    toast.error("Could not show the folder picker", { description: String(error) });
    return null;
  }
}

/** Asks for a folder and opens it as a repository tab. */
export function useOpenRepository(): () => Promise<void> {
  return async () => {
    const path = await pickFolder("Open repository");
    if (path) openRepositories([path]);
  };
}

/** Asks for a folder, runs `git init` there and opens it. Errors surface as toasts. */
export function useCreateRepository(): {
  create: (path?: string) => Promise<void>;
  pending: boolean;
} {
  const init = useInitRepository();
  return {
    pending: init.isPending,
    create: async (path) => {
      const target = path ?? (await pickFolder("Create a repository in…"));
      if (!target) return;
      try {
        await init.mutateAsync(target);
      } catch {
        // The global mutation handler already showed the error as a toast.
        return;
      }
      openRepositories([target]);
    },
  };
}

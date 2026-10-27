import { open } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";

import { useTabsStore } from "@/features/workspace";

import { repositoryTab } from "../lib/path";

/** Opens a tab for each path (focusing the last one). */
export function openRepositories(paths: readonly string[]): void {
  const { openTab } = useTabsStore.getState();
  for (const path of paths) openTab(repositoryTab(path));
}

/** Asks for a folder and opens it as a repository tab. */
export function useOpenRepository(): () => Promise<void> {
  return async () => {
    try {
      const path = await open({ directory: true, title: "Open repository" });
      if (typeof path === "string") openRepositories([path]);
    } catch (error) {
      toast.error("Could not show the folder picker", { description: String(error) });
    }
  };
}

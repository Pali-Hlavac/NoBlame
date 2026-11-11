/** Find (Ctrl+F) and go to commit (Ctrl+Shift+G) for the active repository's commit list. */
import { openFind, openGoTo } from "@/features/graph";
import { useActiveRepository } from "@/features/repositories";
import { useHotkey } from "@/shared/hooks/useHotkey";
import { useKeys } from "@/shared/hooks/useKeys";

export function useHistoryHotkeys(): void {
  const path = useActiveRepository().tab?.path;
  useHotkey(useKeys("history.find"), () => {
    if (path) openFind(path);
  });
  useHotkey(useKeys("history.goto"), () => {
    if (path) openGoTo(path);
  });
}

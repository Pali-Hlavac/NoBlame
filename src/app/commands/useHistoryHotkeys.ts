/** Ctrl+F (find) and Ctrl+Shift+G (go to commit) for the active repository's commit list. */
import { FIND_HOTKEY, GO_TO_HOTKEY, openFind, openGoTo } from "@/features/graph";
import { useActiveRepository } from "@/features/repositories";
import { useHotkey } from "@/shared/hooks/useHotkey";

export function useHistoryHotkeys(): void {
  const path = useActiveRepository().tab?.path;
  useHotkey(FIND_HOTKEY, () => {
    if (path) openFind(path);
  });
  useHotkey(GO_TO_HOTKEY, () => {
    if (path) openGoTo(path);
  });
}

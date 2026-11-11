import { useCallback, useSyncExternalStore } from "react";

import {
  defaultKeysOf,
  keysOf,
  subscribeKeybindings,
  userKeybindings,
} from "@/shared/lib/keybindings";

/** The current keys of shortcut `id` (`keybindings.ts`); re-renders when the user changes them. */
export function useKeys(id: string): string {
  return useSyncExternalStore(subscribeKeybindings, () => keysOf(id));
}

/** The current keys of any shortcut, for components showing several (palette, activity bar). */
export function useKeymap(): (id: string) => string {
  const user = useSyncExternalStore(subscribeKeybindings, userKeybindings);
  return useCallback((id: string) => user.get(id) ?? defaultKeysOf(id), [user]);
}

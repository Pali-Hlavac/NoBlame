/**
 * Suppresses browser behaviour that breaks the native-app illusion: the print shortcuts always,
 * and in production builds also the webview context menu (Back/Refresh/Print/Inspect) and the
 * reload shortcuts. Development builds keep those, so "Inspect" and reloading stay available.
 * Editable fields keep their context menu so copy/paste still works.
 */
import { matchesHotkey } from "./hotkeys";
import { isMacPlatform } from "./platform";

/** Browser shortcuts that would open the print dialog (Ctrl+Shift+P: the system's). */
const PRINT_HOTKEYS = ["mod+p", "mod+shift+p"] as const;

/** Browser shortcuts that would reload the app window. */
const RELOAD_HOTKEYS = ["f5", "mod+r", "mod+shift+r"] as const;

const EDITABLE_SELECTOR = "input, textarea, [contenteditable='true']";

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(EDITABLE_SELECTOR) !== null;
}

/**
 * Installs the global listeners. Call once at startup; `development` keeps the context menu and
 * reloading. Returns a function that removes them again (for tests).
 */
export function installNativeFeel({ development = false } = {}): () => void {
  const isMac = isMacPlatform();
  const blocked: readonly string[] = development
    ? PRINT_HOTKEYS
    : [...PRINT_HOTKEYS, ...RELOAD_HOTKEYS];
  const onContextMenu = (event: MouseEvent): void => {
    if (!isEditableTarget(event.target)) event.preventDefault();
  };
  // Only the browser's own action is cancelled: the app's shortcuts still see the key.
  const onKeyDown = (event: KeyboardEvent): void => {
    if (blocked.some((combo) => matchesHotkey(event, combo, isMac))) event.preventDefault();
  };
  if (!development) window.addEventListener("contextmenu", onContextMenu);
  window.addEventListener("keydown", onKeyDown);
  return () => {
    window.removeEventListener("contextmenu", onContextMenu);
    window.removeEventListener("keydown", onKeyDown);
  };
}

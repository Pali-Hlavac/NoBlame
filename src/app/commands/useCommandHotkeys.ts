/**
 * Palette commands with a keyboard shortcut (`PaletteCommand.keybinding`): the palette shows its
 * current keys, and pressing them anywhere in the window runs the command, unless a dialog is
 * open (it has the keyboard then).
 */
import { useEffect, useRef } from "react";

import type { PaletteCommand } from "@/features/command-palette";
import { isDialogOpen } from "@/shared/lib/dialogs";
import { matchesHotkey } from "@/shared/lib/hotkeys";
import { keysOf } from "@/shared/lib/keybindings";
import { isMacPlatform } from "@/shared/lib/platform";

/** `commands` with the keys of their shortcut as the palette's hint. */
export function withKeybindingHints(
  commands: readonly PaletteCommand[],
  keys: (id: string) => string,
): PaletteCommand[] {
  return commands.map((command) =>
    command.keybinding && command.hotkey === undefined
      ? { ...command, hotkey: keys(command.keybinding) }
      : command,
  );
}

/** Runs the command whose shortcut is pressed; the latest `commands` are always used. */
export function useCommandHotkeys(commands: readonly PaletteCommand[]): void {
  const latest = useRef(commands);
  useEffect(() => {
    latest.current = commands;
  }, [commands]);

  useEffect(() => {
    const isMac = isMacPlatform();
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || isDialogOpen()) return;
      const command = latest.current.find(
        (candidate) =>
          candidate.keybinding !== undefined &&
          matchesHotkey(event, keysOf(candidate.keybinding), isMac),
      );
      if (!command) return;
      event.preventDefault();
      command.run();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);
}

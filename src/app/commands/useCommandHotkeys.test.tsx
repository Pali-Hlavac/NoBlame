import { renderHook } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { PaletteCommand } from "@/features/command-palette";
import { keysOf, setUserKeybindings } from "@/shared/lib/keybindings";

import { useCommandHotkeys, withKeybindingHints } from "./useCommandHotkeys";

function command(run: () => void): PaletteCommand {
  return { id: "remote.push", group: "Remote", label: "Push", keybinding: "remote.push", run };
}

describe("useCommandHotkeys", () => {
  afterEach(() => {
    setUserKeybindings([]);
    document.body.innerHTML = "";
  });

  it("runs a command when its shortcut is pressed, with the keys the user gave", async () => {
    const user = userEvent.setup();
    const run = vi.fn();
    renderHook(() => {
      useCommandHotkeys([command(run)]);
    });
    await user.keyboard("{Control>}p{/Control}");
    expect(run).toHaveBeenCalledTimes(1);

    setUserKeybindings([{ id: "remote.push", keys: "mod+alt+u" }]);
    await user.keyboard("{Control>}p{/Control}");
    expect(run).toHaveBeenCalledTimes(1);
    await user.keyboard("{Control>}{Alt>}u{/Alt}{/Control}");
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("leaves the keys to an open dialog", async () => {
    const user = userEvent.setup();
    const run = vi.fn();
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.append(dialog);
    renderHook(() => {
      useCommandHotkeys([command(run)]);
    });
    await user.keyboard("{Control>}p{/Control}");
    expect(run).not.toHaveBeenCalled();
  });

  it("shows each command's current keys in the palette", () => {
    const [hinted] = withKeybindingHints([command(vi.fn())], keysOf);
    expect(hinted?.hotkey).toBe("mod+p");
  });
});

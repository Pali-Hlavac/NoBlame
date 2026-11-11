import { formatHotkey } from "@/shared/lib/hotkeys";
import { groupedKeybindings } from "@/shared/lib/keybindings";
import { isMacPlatform } from "@/shared/lib/platform";
import { Kbd } from "@/shared/ui/kbd";

import { Section } from "./SettingControls";

/**
 * Every keyboard shortcut, by where it works (from the one registry, `keybindings.ts`).
 * Changing them is the next step of M7 slice 8.
 */
export function ShortcutsSection() {
  const mac = isMacPlatform();
  return (
    <Section title="Keyboard shortcuts">
      <p className="text-xs text-muted-foreground">
        Every shortcut of the app. Changing them comes next; the command palette (
        {formatHotkey("mod+k", mac)}) also lists each command with its shortcut.
      </p>
      {groupedKeybindings().map(([group, bindings]) => (
        <div key={group}>
          <h3 className="mb-1 text-sm font-medium">{group}</h3>
          <ul aria-label={`${group} shortcuts`} className="text-sm">
            {bindings.map((binding) => (
              <li key={binding.id} className="flex items-center justify-between gap-2 py-0.5">
                <span>{binding.label}</span>
                <Kbd combo={binding.keys} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </Section>
  );
}

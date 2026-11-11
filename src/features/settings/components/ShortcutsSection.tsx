import { useKeymap, useKeys } from "@/shared/hooks/useKeys";
import { formatHotkey } from "@/shared/lib/hotkeys";
import { KEYBINDINGS, groupedKeybindings } from "@/shared/lib/keybindings";
import { isMacPlatform } from "@/shared/lib/platform";
import { Button } from "@/shared/ui/button";

import { useChangeSettings } from "../hooks/useAppSettings";
import { shortcutProblem, withShortcut } from "../lib/shortcuts";
import { Section } from "./SettingControls";
import { ShortcutRow } from "./ShortcutRow";

/**
 * Every keyboard shortcut, by where it works (from the one registry, `keybindings.ts`), each
 * changeable: the changed ones are saved in the settings and apply at once.
 */
export function ShortcutsSection() {
  const mac = isMacPlatform();
  const keysOf = useKeymap();
  const palette = useKeys("palette.open");
  const change = useChangeSettings();
  const changed = KEYBINDINGS.filter((binding) => keysOf(binding.id) !== binding.keys).length;

  const save = (id: string, keys: string): void => {
    change((current) => ({
      ...current,
      keybindings: withShortcut(current.keybindings, id, keys),
    }));
  };

  return (
    <Section title="Keyboard shortcuts">
      <p className="text-xs text-muted-foreground">
        Click a shortcut and press its new keys; it works at once.
        {palette
          ? ` The command palette (${formatHotkey(palette, mac)}) also lists each command with its shortcut.`
          : " The command palette also lists each command with its shortcut."}
      </p>
      {groupedKeybindings().map(([group, bindings]) => (
        <div key={group}>
          <h3 className="mb-1 text-sm font-medium">{group}</h3>
          <ul aria-label={`${group} shortcuts`}>
            {bindings.map((binding) => (
              <ShortcutRow
                key={binding.id}
                binding={binding}
                keys={keysOf(binding.id)}
                problemOf={(keys) => shortcutProblem(binding.id, keys, keysOf, mac)}
                onChange={(keys) => {
                  save(binding.id, keys);
                }}
              />
            ))}
          </ul>
        </div>
      ))}
      {changed > 0 ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            change((current) => ({ ...current, keybindings: [] }));
          }}
        >
          Reset all shortcuts ({changed} changed)
        </Button>
      ) : null}
    </Section>
  );
}

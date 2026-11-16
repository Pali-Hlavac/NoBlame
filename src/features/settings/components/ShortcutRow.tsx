import { RotateCcwIcon } from "lucide-react";
import { useState, type KeyboardEvent } from "react";

import { comboOfEvent, formatHotkey } from "@/shared/lib/hotkeys";
import type { Keybinding } from "@/shared/lib/keybindings";
import { cn } from "@/shared/lib/cn";
import { isMacPlatform } from "@/shared/lib/platform";
import { Button } from "@/shared/ui/button";
import { Kbd } from "@/shared/ui/kbd";

interface ShortcutRowProps {
  binding: Keybinding;
  /** Its keys now; empty for none. */
  keys: string;
  /** Why these keys cannot be its keys (`shortcutProblem`), or `null`. */
  problemOf: (keys: string) => string | null;
  onChange: (keys: string) => void;
}

/**
 * One shortcut: what it does and its keys. Clicking the keys records new ones (Esc cancels,
 * Backspace leaves it without a shortcut); refused keys say why and recording goes on.
 */
export function ShortcutRow({ binding, keys, problemOf, onChange }: ShortcutRowProps) {
  const mac = isMacPlatform();
  const [recording, setRecording] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const now = keys ? formatHotkey(keys, mac) : "no shortcut";

  const stop = (): void => {
    setRecording(false);
    setProblem(null);
  };
  const take = (combo: string): void => {
    const why = problemOf(combo);
    if (why) {
      setProblem(why);
      return;
    }
    onChange(combo);
    stop();
  };

  const record = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (!recording || event.repeat) return;
    const plain = !event.ctrlKey && !event.metaKey && !event.altKey;
    // Tab (with or without Shift) still moves on, which ends recording.
    if (plain && event.key === "Tab") return;
    // The app's own shortcuts must not run while their keys are pressed here.
    event.preventDefault();
    event.stopPropagation();
    if (plain && !event.shiftKey && event.key === "Escape") {
      stop();
    } else if (plain && !event.shiftKey && (event.key === "Backspace" || event.key === "Delete")) {
      onChange("");
      stop();
    } else {
      const combo = comboOfEvent(event.nativeEvent, mac);
      if (combo) take(combo);
    }
  };

  return (
    <li data-setting-item className="py-0.5 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span>{binding.label}</span>
        <div className="flex items-center gap-1">
          {keys !== binding.keys && !recording ? (
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              aria-label={`Reset ${binding.label} to ${formatHotkey(binding.keys, mac)}`}
              title={`Back to ${formatHotkey(binding.keys, mac)}`}
              onClick={() => {
                const why = problemOf(binding.keys);
                setProblem(why);
                if (!why) onChange(binding.keys);
              }}
            >
              <RotateCcwIcon />
            </Button>
          ) : null}
          <button
            type="button"
            aria-label={
              recording
                ? `Press the new keys for ${binding.label}`
                : `Change the shortcut of ${binding.label}, now ${now}`
            }
            className={cn(
              "inline-flex h-7 min-w-24 items-center justify-center rounded-md border border-border bg-background px-2 text-xs outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
              recording && "ring-2 ring-ring",
            )}
            onClick={() => {
              setProblem(null);
              setRecording(true);
            }}
            onKeyDown={record}
            onBlur={stop}
          >
            {recording ? (
              "Press keys…"
            ) : keys ? (
              <Kbd combo={keys} />
            ) : (
              <span className="text-muted-foreground">None</span>
            )}
          </button>
        </div>
      </div>
      {recording ? (
        <p className="text-right text-xs text-muted-foreground">
          Esc cancels, Backspace removes the shortcut.
        </p>
      ) : null}
      {problem ? (
        <p role="alert" className="text-right text-xs text-destructive">
          {problem}
        </p>
      ) : null}
    </li>
  );
}

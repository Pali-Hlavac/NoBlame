import { useId, type ReactNode } from "react";

import { useAppSettings, useChangeSettings } from "../hooks/useAppSettings";
import { useThemePreference } from "../hooks/useThemePreference";
import { THEME_OPTIONS, isThemePreference } from "../lib/theme";

/** Milestone that makes keyboard shortcuts configurable (shown in the UI as planned). */
const SHORTCUTS_MILESTONE = "M7";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="border-b border-border pb-1 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

interface ToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** A checkbox with a label and a sentence saying what it changes. */
function Toggle({ label, description, checked, onChange }: ToggleProps) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        aria-describedby={`${id}-description`}
        className="mt-0.5 size-4 shrink-0 accent-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        checked={checked}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
      />
      <div className="space-y-0.5">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <p id={`${id}-description`} className="text-xs text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}

function ThemeChoice() {
  const { preference, setPreference } = useThemePreference();
  const name = useId();
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Theme</legend>
      <div className="flex gap-4">
        {THEME_OPTIONS.map((option) => (
          <label key={option.value} className="flex items-center gap-1.5 text-sm">
            <input
              type="radio"
              name={name}
              value={option.value}
              className="size-4 accent-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              checked={preference === option.value}
              onChange={(event) => {
                if (isThemePreference(event.target.value)) setPreference(event.target.value);
              }}
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** The Settings tab: every preference, saved as soon as it changes. */
export function SettingsView() {
  const settings = useAppSettings();
  const change = useChangeSettings();
  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-2xl space-y-8 p-6">
        <h1 className="text-lg font-semibold">Settings</h1>
        <Section title="Appearance">
          <ThemeChoice />
        </Section>
        <Section title="Commit graph">
          <Toggle
            label="Highlight the selected commit"
            description="Dims everything outside the selected commit's history and marks the commits by the same author. Esc clears it."
            checked={settings.graph.highlightSelection}
            onChange={(checked) => {
              change((current) => ({
                ...current,
                graph: { ...current.graph, highlightSelection: checked },
              }));
            }}
          />
        </Section>
        <Section title="Repositories">
          <Toggle
            label="Show the actions button (…) on repositories"
            description="Each repository in the Repositories module gets a menu with its actions."
            checked={settings.repositories.showActionsMenu}
            onChange={(checked) => {
              change((current) => ({
                ...current,
                repositories: { ...current.repositories, showActionsMenu: checked },
              }));
            }}
          />
        </Section>
        <Section title="Keyboard shortcuts">
          <p className="text-sm text-muted-foreground">
            Changing shortcuts arrives in {SHORTCUTS_MILESTONE}. Until then, the command palette
            lists each command with its shortcut.
          </p>
        </Section>
      </div>
    </div>
  );
}

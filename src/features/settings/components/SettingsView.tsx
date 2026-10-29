import type { WorkingTreeDisplay } from "@/shared/ipc/bindings";

import { useAppSettings, useChangeSettings } from "../hooks/useAppSettings";
import { useDiffSettings } from "../hooks/useDiffSettings";
import { useThemePreference } from "../hooks/useThemePreference";
import {
  CONTEXT_OPTIONS,
  DIFF_LAYOUT_OPTIONS,
  WHITESPACE_OPTIONS,
  contextLines,
  contextValue,
} from "../lib/diff";
import { THEME_OPTIONS } from "../lib/theme";
import { Choice, Section, Toggle } from "./SettingControls";

/** Milestone that makes keyboard shortcuts configurable (shown in the UI as planned). */
const SHORTCUTS_MILESTONE = "M7";

const WORKING_TREE_OPTIONS: readonly { value: WorkingTreeDisplay; label: string }[] = [
  { value: "rows", label: "Rows at the top of the commit graph" },
  { value: "header", label: "A summary in the repository header" },
  { value: "hidden", label: "Not shown" },
];

function ThemeChoice() {
  const { preference, setPreference } = useThemePreference();
  return (
    <Choice
      legend="Theme"
      options={THEME_OPTIONS}
      value={preference}
      onChange={setPreference}
      inline
    />
  );
}

function DiffSection() {
  const [diff, changeDiff] = useDiffSettings();
  return (
    <Section title="Diff">
      <Choice
        legend="Layout"
        options={DIFF_LAYOUT_OPTIONS}
        value={diff.layout}
        onChange={(layout) => {
          changeDiff({ layout });
        }}
        inline
      />
      <Choice
        legend="Whitespace"
        options={WHITESPACE_OPTIONS}
        value={diff.whitespace}
        onChange={(whitespace) => {
          changeDiff({ whitespace });
        }}
      />
      <Choice
        legend="Unchanged lines around each change"
        options={CONTEXT_OPTIONS}
        value={contextValue(diff.contextLines)}
        onChange={(value) => {
          changeDiff({ contextLines: contextLines(value) });
        }}
        inline
      />
    </Section>
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
          <Choice
            legend="Show uncommitted changes as"
            options={WORKING_TREE_OPTIONS}
            value={settings.graph.workingTree}
            onChange={(workingTree) => {
              change((current) => ({ ...current, graph: { ...current.graph, workingTree } }));
            }}
          />
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
        <DiffSection />
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

import type { BranchSort, WorkingTreeDisplay } from "@/shared/ipc/bindings";

import { useAppSettings, useChangeSettings } from "../hooks/useAppSettings";
import { useDiffSettings } from "../hooks/useDiffSettings";
import { useThemePreference } from "../hooks/useThemePreference";
import { DIFF_LAYOUT_OPTIONS, WHITESPACE_OPTIONS } from "../lib/diff";
import { THEME_OPTIONS } from "../lib/theme";
import { ContextStepper } from "./ContextStepper";
import { ExternalToolSetting } from "./ExternalToolSetting";
import { GraphColumnsSetting } from "./GraphColumnsSetting";
import { RepositoryButtonsSetting } from "./RepositoryButtonsSetting";
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
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Unchanged lines around each change</legend>
        <ContextStepper />
      </fieldset>
      <Toggle
        label="Colour code by its language"
        description="Syntax highlighting for over 200 languages. Files over 4 MB are not coloured."
        checked={diff.syntaxHighlighting}
        onChange={(syntaxHighlighting) => {
          changeDiff({ syntaxHighlighting });
        }}
      />
      <ExternalToolSetting />
    </Section>
  );
}

const BRANCH_SORT_OPTIONS: readonly { value: BranchSort; label: string }[] = [
  { value: "name", label: "By name" },
  { value: "lastCommit", label: "By last commit, newest first" },
];

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
          <GraphColumnsSetting />
        </Section>
        <DiffSection />
        <Section title="Branches">
          <Choice
            legend="Order of the branches and tags"
            options={BRANCH_SORT_OPTIONS}
            value={settings.branches.sort}
            onChange={(sort) => {
              change((current) => ({ ...current, branches: { ...current.branches, sort } }));
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
          <Toggle
            label="Show the number of uncommitted files beside repositories"
            description="New, changed and deleted files, counted again when NoBlame regains focus. Closed repositories run git status for it, which takes longer on very large working trees."
            checked={settings.repositories.showChangeCounts}
            onChange={(checked) => {
              change((current) => ({
                ...current,
                repositories: { ...current.repositories, showChangeCounts: checked },
              }));
            }}
          />
          <RepositoryButtonsSetting />
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

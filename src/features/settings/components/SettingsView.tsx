import type { BranchSort, FileDisplay, WorkingTreeDisplay } from "@/shared/ipc/bindings";

import { useAppSettings, useChangeSettings } from "../hooks/useAppSettings";
import { useDiffSettings } from "../hooks/useDiffSettings";
import { useThemePreference } from "../hooks/useThemePreference";
import { DIFF_LAYOUT_OPTIONS, WHITESPACE_OPTIONS } from "../lib/diff";
import { THEME_OPTIONS } from "../lib/theme";
import { AppIconChoice } from "./AppIconChoice";
import { ContextStepper } from "./ContextStepper";
import { ExternalToolSetting } from "./ExternalToolSetting";
import { MergeToolSetting } from "./MergeToolSetting";
import { GraphColumnsSetting } from "./GraphColumnsSetting";
import { JobsSection } from "./JobsSection";
import { GitConfigSection } from "./GitConfigSection";
import { ScriptsSection } from "./ScriptsSection";
import { ShortcutsSection } from "./ShortcutsSection";
import { SubmodulesSection } from "./SubmodulesSection";
import { TaskWindowsSection } from "./TaskWindowsSection";
import { RepositoryButtonsSetting } from "./RepositoryButtonsSetting";
import { Choice, Section, Toggle } from "./SettingControls";
import { SettingsSearch } from "./SettingsSearch";

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
      <MergeToolSetting />
    </Section>
  );
}

const BRANCH_SORT_OPTIONS: readonly { value: BranchSort; label: string }[] = [
  { value: "name", label: "By name" },
  { value: "lastCommit", label: "By last commit, newest first" },
];

const FILE_DISPLAY_OPTIONS: readonly { value: FileDisplay; label: string }[] = [
  { value: "nameFirst", label: "The name, then its folder" },
  { value: "pathFirst", label: "The folder, then the name, sorted by the whole path" },
];

/** The Settings tab: every preference, saved as soon as it changes. */
export function SettingsView() {
  const settings = useAppSettings();
  const change = useChangeSettings();
  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-2xl space-y-8 p-6">
        <h1 className="text-lg font-semibold">Settings</h1>
        <SettingsSearch>
          <Section title="Appearance">
            <ThemeChoice />
            <AppIconChoice />
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
            <Toggle
              label="Show the rest of the message"
              description="The message column shows the commit message's body, greyed, after its subject (as one line)."
              checked={settings.graph.showMessageBody}
              onChange={(showMessageBody) => {
                change((current) => ({ ...current, graph: { ...current.graph, showMessageBody } }));
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
          <Section title="Commit">
            <Choice
              legend="Files in the Changes and Staged lists"
              options={FILE_DISPLAY_OPTIONS}
              value={settings.commit.fileDisplay}
              onChange={(fileDisplay) => {
                change((current) => ({ ...current, commit: { ...current.commit, fileDisplay } }));
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
          <JobsSection />
          <SubmodulesSection />
          <TaskWindowsSection />
          <ScriptsSection />
          <GitConfigSection />
          <ShortcutsSection />
        </SettingsSearch>
      </div>
    </div>
  );
}

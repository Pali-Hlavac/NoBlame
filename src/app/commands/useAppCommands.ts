/** Composes the command-palette entries contributed by each feature. */
import {
  CrosshairIcon,
  ExternalLinkIcon,
  FolderDownIcon,
  FolderOpenIcon,
  FolderPlusIcon,
  GitBranchIcon,
  GitCompareArrowsIcon,
  InfoIcon,
  LayoutGridIcon,
  LayoutTemplateIcon,
  MonitorIcon,
  MoonIcon,
  SearchIcon,
  SettingsIcon,
  SunIcon,
  XIcon,
} from "lucide-react";

import { APP_NAME } from "@/app.config";
import { useAboutStore } from "@/features/about";
import type { PaletteCommand } from "@/features/command-palette";
import { useGitInfo } from "@/features/git-env";
import { openClone } from "@/features/remotes";
import { openFind, openGoTo } from "@/features/graph";
import {
  useActiveRepository,
  useCreateRepository,
  useOpenRepository,
} from "@/features/repositories";
import { THEME_OPTIONS, useThemePreference } from "@/features/settings";
import { TASKS, TASK_WINDOWS_MILESTONE, useOpenTaskWindow } from "@/features/windows";
import { openModule, resetLayout, type WorkbenchModule } from "@/features/workbench";
import { WELCOME_TAB, showCompareTab, useActiveTab, useTabsStore } from "@/features/workspace";
import { useKeymap } from "@/shared/hooks/useKeys";
import type { TaskKind } from "@/shared/ipc/bindings";

import { openSettings } from "../layout/settingsTab";
import { useBranchCommands } from "../workbench/branchCommands";
import { useCommitCommands } from "../workbench/commit";
import { useRemoteCommands } from "../workbench/remoteCommands";

const THEME_ICONS = { system: MonitorIcon, light: SunIcon, dark: MoonIcon } as const;

/** Every command available in the palette, in display order. */
export function useAppCommands(modules: readonly WorkbenchModule[]): PaletteCommand[] {
  const { setPreference } = useThemePreference();
  const openRepository = useOpenRepository();
  const createRepository = useCreateRepository();
  const openTaskWindow = useOpenTaskWindow();
  const gitInfo = useGitInfo();
  const activeTab = useActiveTab();
  const activeRepository = useActiveRepository();
  const commitCommands = useCommitCommands();
  const remoteCommands = useRemoteCommands();
  const branchCommands = useBranchCommands();
  const keysOf = useKeymap();
  const repositoryPath = activeTab?.kind === "repository" ? activeTab.path : null;

  const taskCommands = repositoryPath
    ? (Object.keys(TASKS) as TaskKind[]).map((task): PaletteCommand => ({
        id: `task.${task}`,
        group: `Task windows (placeholders until ${TASK_WINDOWS_MILESTONE})`,
        label: `Open ${TASKS[task].title} window`,
        icon: ExternalLinkIcon,
        keywords: [TASKS[task].command, "window"],
        run: () => {
          openTaskWindow.mutate({ task, path: repositoryPath });
        },
      }))
    : [];

  const moduleCommands = modules.map((module): PaletteCommand => ({
    id: `module.${module.id}`,
    group: "View",
    label: `Show ${module.title}`,
    icon: module.icon,
    kind: module.kind,
    hotkey: module.keybinding ? keysOf(module.keybinding) : undefined,
    keywords: ["module", "panel", "sidebar"],
    run: () => {
      openModule(module);
    },
  }));

  const historyPath = activeRepository.tab?.path;
  const historyCommands: PaletteCommand[] = historyPath
    ? [
        {
          id: "history.find",
          group: "History",
          label: "Find commits…",
          icon: SearchIcon,
          kind: "history",
          hotkey: keysOf("history.find"),
          keywords: ["search", "message", "author", "hash"],
          run: () => {
            openFind(historyPath);
          },
        },
        {
          id: "history.goto",
          group: "History",
          label: "Go to commit…",
          icon: CrosshairIcon,
          kind: "history",
          hotkey: keysOf("history.goto"),
          keywords: ["jump", "hash", "id", "revision", "branch", "tag"],
          run: () => {
            openGoTo(historyPath);
          },
        },
        {
          id: "history.compare",
          group: "History",
          label: "Compare branches or commits…",
          icon: GitCompareArrowsIcon,
          kind: "history",
          keywords: ["diff", "two", "revisions", "branch", "tag"],
          // The tab keeps what it compared last, or asks for both sides.
          run: showCompareTab,
        },
      ]
    : [];

  const themeCommands = THEME_OPTIONS.map((option): PaletteCommand => ({
    id: `theme.${option.value}`,
    group: "Appearance",
    label: `Theme: ${option.label}`,
    icon: THEME_ICONS[option.value],
    keywords: ["color", "mode", "appearance"],
    run: () => {
      setPreference(option.value);
    },
  }));

  return [
    {
      id: "repository.open",
      group: "Repository",
      label: "Open repository…",
      icon: FolderOpenIcon,
      kind: "repositories",
      keywords: ["folder", "browse"],
      run: () => void openRepository(),
    },
    {
      id: "repository.clone",
      group: "Repository",
      label: "Clone repository…",
      icon: FolderDownIcon,
      kind: "repositories",
      keywords: ["download", "copy", "url", "remote"],
      run: openClone,
    },
    {
      id: "repository.create",
      group: "Repository",
      label: "Create repository…",
      icon: FolderPlusIcon,
      kind: "repositories",
      keywords: ["init", "new"],
      run: () => void createRepository.create(),
    },
    ...commitCommands,
    ...branchCommands,
    ...remoteCommands,
    ...historyCommands,
    ...taskCommands,
    {
      id: "tabs.welcome",
      group: "Tabs",
      label: "Open Welcome tab",
      icon: LayoutGridIcon,
      run: () => {
        useTabsStore.getState().openTab(WELCOME_TAB);
      },
    },
    {
      id: "tabs.close",
      group: "Tabs",
      label: "Close current tab",
      icon: XIcon,
      hotkey: keysOf("tabs.close"),
      run: () => {
        const { activeTabId, closeTab } = useTabsStore.getState();
        if (activeTabId) closeTab(activeTabId);
      },
    },
    ...moduleCommands,
    {
      id: "layout.reset",
      group: "View",
      label: "Reset layout",
      icon: LayoutTemplateIcon,
      keywords: ["dock", "panels", "default", "workbench"],
      run: () => {
        resetLayout().catch((error: unknown) => {
          console.warn("Resetting the layout failed", error);
        });
      },
    },
    {
      id: "app.settings",
      group: "View",
      label: "Open settings",
      icon: SettingsIcon,
      hotkey: keysOf("settings.open"),
      keywords: ["preferences", "options"],
      run: openSettings,
    },
    ...themeCommands,
    {
      id: "git.check",
      group: "Help",
      label: "Check git installation again",
      icon: GitBranchIcon,
      keywords: ["version", "path", "install"],
      run: () => void gitInfo.refetch(),
    },
    {
      id: "help.about",
      group: "Help",
      label: `About ${APP_NAME}`,
      icon: InfoIcon,
      keywords: ["version"],
      run: () => {
        useAboutStore.getState().setOpen(true);
      },
    },
  ];
}

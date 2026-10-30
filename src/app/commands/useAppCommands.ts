/** Composes the command-palette entries contributed by each feature. */
import {
  CrosshairIcon,
  ExternalLinkIcon,
  FolderOpenIcon,
  FolderPlusIcon,
  GitBranchIcon,
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
import { FIND_HOTKEY, GO_TO_HOTKEY, openFind, openGoTo } from "@/features/graph";
import {
  useActiveRepository,
  useCreateRepository,
  useOpenRepository,
} from "@/features/repositories";
import { THEME_OPTIONS, useThemePreference } from "@/features/settings";
import { TASKS, TASK_WINDOWS_MILESTONE, useOpenTaskWindow } from "@/features/windows";
import { openModule, resetLayout, type WorkbenchModule } from "@/features/workbench";
import { TAB_HOTKEYS, WELCOME_TAB, useActiveTab, useTabsStore } from "@/features/workspace";
import type { TaskKind } from "@/shared/ipc/bindings";

import { SETTINGS_HOTKEY, openSettings } from "../layout/settingsTab";

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
    hotkey: module.hotkey,
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
          hotkey: FIND_HOTKEY,
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
          hotkey: GO_TO_HOTKEY,
          keywords: ["jump", "hash", "id", "revision", "branch", "tag"],
          run: () => {
            openGoTo(historyPath);
          },
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
      keywords: ["folder", "browse"],
      run: () => void openRepository(),
    },
    {
      id: "repository.create",
      group: "Repository",
      label: "Create repository…",
      icon: FolderPlusIcon,
      keywords: ["init", "new"],
      run: () => void createRepository.create(),
    },
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
      hotkey: TAB_HOTKEYS.close,
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
      hotkey: SETTINGS_HOTKEY,
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

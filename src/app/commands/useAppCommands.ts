/** Composes the command-palette entries contributed by each feature. */
import {
  ExternalLinkIcon,
  FolderOpenIcon,
  GitBranchIcon,
  InfoIcon,
  LayoutGridIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
  XIcon,
} from "lucide-react";

import { APP_NAME } from "@/app.config";
import { useAboutStore } from "@/features/about";
import type { PaletteCommand } from "@/features/command-palette";
import { useGitInfo } from "@/features/git-env";
import { useOpenRepository } from "@/features/repositories";
import { THEME_OPTIONS, useThemePreference } from "@/features/settings";
import { TASKS, TASK_WINDOWS_MILESTONE, useOpenTaskWindow } from "@/features/windows";
import { TAB_HOTKEYS, WELCOME_TAB, useActiveTab, useTabsStore } from "@/features/workspace";
import type { TaskKind } from "@/shared/ipc/bindings";

const THEME_ICONS = { system: MonitorIcon, light: SunIcon, dark: MoonIcon } as const;

/** Every command available in the palette, in display order. */
export function useAppCommands(): PaletteCommand[] {
  const { setPreference } = useThemePreference();
  const openRepository = useOpenRepository();
  const openTaskWindow = useOpenTaskWindow();
  const gitInfo = useGitInfo();
  const activeTab = useActiveTab();
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

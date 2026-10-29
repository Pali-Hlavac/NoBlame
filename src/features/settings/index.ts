/** Public API of the settings feature. */
export { useSettings } from "./api/settings";
export { SettingsView } from "./components/SettingsView";
export { ThemeController } from "./components/ThemeController";
export { ThemeMenu } from "./components/ThemeMenu";
export { useAppSettings } from "./hooks/useAppSettings";
export { useDiffSettings } from "./hooks/useDiffSettings";
export {
  CONTEXT_OPTIONS,
  DIFF_LAYOUT_OPTIONS,
  WHITESPACE_OPTIONS,
  WHOLE_FILE_CONTEXT,
  contextLines,
  contextValue,
} from "./lib/diff";
export { useThemePreference } from "./hooks/useThemePreference";
export { THEME_OPTIONS } from "./lib/theme";

import { useEffect } from "react";

import { usePrefersDark } from "@/shared/hooks/usePrefersDark";

import { useThemePreference } from "../hooks/useThemePreference";
import { resolveTheme } from "../lib/theme";

/** Where the preference is kept for `public/theme-boot.js`, which applies it before the app loads. */
const THEME_STORAGE_KEY = "noblame.theme";

/**
 * Applies the resolved theme to `<html>` (the `dark` class and `color-scheme`), and remembers
 * the preference in local storage so the next start screen has the right colours at once.
 */
export function ThemeController() {
  const { preference } = useThemePreference();
  const systemPrefersDark = usePrefersDark();
  const theme = resolveTheme(preference, systemPrefersDark);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // No storage: the start screen follows the system theme.
    }
  }, [preference]);

  return null;
}

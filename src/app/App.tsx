import { Toaster } from "sonner";

import { AboutDialog } from "@/features/about";
import {
  KeybindingsController,
  ThemeController,
  useSettings,
  useThemePreference,
} from "@/features/settings";
import { TaskWindowView, useWindowContext } from "@/features/windows";
import { ErrorState } from "@/shared/components/ErrorState";

import { MainWindow } from "./layout/MainWindow";
import { StartupCurtain } from "./layout/StartupCurtain";

/** The main window or a task window, with the dialogs and toasts every window has. */
function Window({ context }: { context: ReturnType<typeof useWindowContext> }) {
  const { preference } = useThemePreference();
  return (
    <>
      <ThemeController />
      <KeybindingsController />
      {context.error ? (
        <ErrorState
          error={context.error}
          title="This window could not start"
          onRetry={() => void context.refetch()}
          className="h-screen justify-center"
        />
      ) : context.data?.kind === "main" ? (
        <MainWindow />
      ) : context.data ? (
        <TaskWindowView task={context.data.task} path={context.data.path} />
      ) : null}
      <AboutDialog />
      <Toaster theme={preference} position="bottom-right" richColors closeButton />
    </>
  );
}

/**
 * Root component of every window. The window asks the backend what it is for: the main
 * window, or a task window opened from the command line (`noblame commit <path>`). Waits for
 * settings so the first paint already uses the saved theme; the startup curtain covers the
 * window until it has loaded.
 */
export function App() {
  const settings = useSettings();
  const context = useWindowContext();
  const starting = settings.isPending || context.isPending;
  return (
    <>
      {!starting && <Window context={context} />}
      <StartupCurtain rendered={!starting} />
    </>
  );
}

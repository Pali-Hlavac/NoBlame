import { Toaster } from "sonner";

import { AboutDialog } from "@/features/about";
import { ThemeController, useSettings, useThemePreference } from "@/features/settings";
import { TaskWindowView, useWindowContext } from "@/features/windows";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";

import { MainWindow } from "./layout/MainWindow";

/**
 * Root component of every window. The window asks the backend what it is for: the main
 * window, or a task window opened from the command line (`noblame commit <path>`). Waits for
 * settings so the first paint already uses the saved theme.
 */
export function App() {
  const settings = useSettings();
  const context = useWindowContext();
  const { preference } = useThemePreference();

  if (settings.isPending || context.isPending) {
    return <LoadingState label="Starting…" className="h-screen" />;
  }

  return (
    <>
      <ThemeController />
      {context.error ? (
        <ErrorState
          error={context.error}
          title="This window could not start"
          onRetry={() => void context.refetch()}
          className="h-screen justify-center"
        />
      ) : context.data.kind === "main" ? (
        <MainWindow />
      ) : (
        <TaskWindowView task={context.data.task} path={context.data.path} />
      )}
      <AboutDialog />
      <Toaster theme={preference} position="bottom-right" richColors closeButton />
    </>
  );
}

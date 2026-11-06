import { useAppSettings, useChangeSettings } from "../hooks/useAppSettings";
import { Section, Toggle } from "./SettingControls";

/** Settings of background jobs: the Git output window. */
export function JobsSection() {
  const jobs = useAppSettings().jobs;
  const change = useChangeSettings();
  const set = (patch: Partial<typeof jobs>): void => {
    change((current) => ({ ...current, jobs: { ...current.jobs, ...patch } }));
  };
  return (
    <Section title="Fetch, pull and push">
      <Toggle
        label="Show git's output in a window while they run"
        description="A Git output window opens beside your work, like a console. Without it they run in the background; their output stays in the jobs list (status bar)."
        checked={jobs.showOutputWindow}
        onChange={(checked) => {
          set({ showOutputWindow: checked });
        }}
      />
      <Toggle
        label="Close the window when they succeed"
        description="It stays open when something fails, so you can read why."
        checked={jobs.closeOutputOnSuccess}
        onChange={(checked) => {
          set({ closeOutputOnSuccess: checked });
        }}
      />
    </Section>
  );
}

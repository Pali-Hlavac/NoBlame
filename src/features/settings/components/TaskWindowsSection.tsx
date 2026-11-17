import { useAppSettings, useChangeSettings } from "../hooks/useAppSettings";
import { Section, Toggle } from "./SettingControls";

/** How task windows (`noblame commit <path>` and the others) behave. */
export function TaskWindowsSection() {
  const taskWindows = useAppSettings().taskWindows;
  const change = useChangeSettings();
  return (
    <Section title="Task windows">
      <Toggle
        label="Close a task window once its action succeeded"
        description="A Commit, Pull, Push, Fetch, Switch, Merge, Rebase or Stash window opened from the command line or a file manager closes a moment after it worked. It stays open when something fails or conflicts, so you can see why."
        checked={taskWindows.closeAfterSuccess}
        onChange={(checked) => {
          change((current) => ({
            ...current,
            taskWindows: { ...current.taskWindows, closeAfterSuccess: checked },
          }));
        }}
      />
    </Section>
  );
}

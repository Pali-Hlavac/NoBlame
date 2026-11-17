import { useAppSettings, useChangeSettings } from "../hooks/useAppSettings";
import { Section, Toggle } from "./SettingControls";

/** Whether NoBlame looks for a new release after starting (ADR 0017). */
export function UpdatesSection() {
  const updates = useAppSettings().updates;
  const change = useChangeSettings();
  return (
    <Section title="Updates">
      <Toggle
        label="Look for a new version when NoBlame starts"
        description="Asks NoBlame's release page once, shortly after the start, and offers what it finds; nothing is installed until you say so. Only installed releases update; a build from source does not."
        checked={updates.checkOnStart}
        onChange={(checkOnStart) => {
          change((current) => ({ ...current, updates: { ...current.updates, checkOnStart } }));
        }}
      />
    </Section>
  );
}

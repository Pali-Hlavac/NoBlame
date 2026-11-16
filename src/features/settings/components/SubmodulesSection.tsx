import { useAppSettings, useChangeSettings } from "../hooks/useAppSettings";
import { Section, Toggle } from "./SettingControls";

/** How submodules follow their repository: fetched with it, updated after pull and checkout. */
export function SubmodulesSection() {
  const submodules = useAppSettings().submodules;
  const change = useChangeSettings();
  const set = (patch: Partial<typeof submodules>): void => {
    change((current) => ({ ...current, submodules: { ...current.submodules, ...patch } }));
  };
  return (
    <Section title="Submodules">
      <Toggle
        label="Fetch the submodules too"
        description="Fetch also fetches every submodule, so their new commits are there before you update them. Off: Git fetches only the submodules whose pointers changed."
        checked={submodules.fetchSubmodules}
        onChange={(checked) => {
          set({ fetchSubmodules: checked });
        }}
      />
      <Toggle
        label="Update the submodules after pull and checkout"
        description="Pull and checking out a branch or commit move the submodules to the commits the repository then records. Submodules not set up yet are left alone. Off: a bar offers it instead."
        checked={submodules.updateAfterPullAndCheckout}
        onChange={(checked) => {
          set({ updateAfterPullAndCheckout: checked });
        }}
      />
    </Section>
  );
}

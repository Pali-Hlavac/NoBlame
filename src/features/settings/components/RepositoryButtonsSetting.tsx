import type { RepositoryButton } from "@/shared/ipc/bindings";

import { useAppSettings, useChangeSettings } from "../hooks/useAppSettings";

const BUTTONS: readonly { value: RepositoryButton; label: string }[] = [
  { value: "pull", label: "Pull on each repository" },
  { value: "push", label: "Push on each repository" },
  { value: "pullAll", label: "Pull all on each group" },
  { value: "pushAll", label: "Push all on each group" },
];

/** Which quick buttons the Repositories module shows on its rows. */
export function RepositoryButtonsSetting() {
  const buttons = useAppSettings().repositories.buttons;
  const change = useChangeSettings();
  const toggle = (button: RepositoryButton, on: boolean): void => {
    change((current) => {
      const others = current.repositories.buttons.filter((each) => each !== button);
      return {
        ...current,
        repositories: { ...current.repositories, buttons: on ? [...others, button] : others },
      };
    });
  };
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Quick buttons</legend>
      <p className="text-xs text-muted-foreground">
        Shown when the pointer is over a row (or it has focus). Push sends the current branch to its
        upstream; Pull all and Push all start one job per repository in the group.
      </p>
      <div className="space-y-1.5">
        {BUTTONS.map((button) => (
          <label key={button.value} className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              checked={buttons.includes(button.value)}
              onChange={(event) => {
                toggle(button.value, event.target.checked);
              }}
            />
            {button.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

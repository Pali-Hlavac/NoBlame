import { useId } from "react";

import type { AppIcon } from "@/shared/ipc/bindings";
import { cn } from "@/shared/lib/cn";

import { useAppSettings, useChangeSettings } from "../hooks/useAppSettings";

/** Shown at this size, as a taskbar would at high scaling. */
const PREVIEW_SIZE_PX = 48;

const APP_ICONS: readonly { value: AppIcon; label: string; src: string }[] = [
  { value: "golden", label: "Golden", src: "/icon.png" },
  { value: "vibrant", label: "Vibrant", src: "/icon-vibrant.png" },
];

/** Which of the two icons the app's windows show. */
export function AppIconChoice() {
  const name = useId();
  const appIcon = useAppSettings().appIcon;
  const change = useChangeSettings();
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">App icon</legend>
      <div className="flex gap-3">
        {APP_ICONS.map((option) => (
          <label
            key={option.value}
            className={cn(
              "flex cursor-pointer flex-col items-center gap-1.5 rounded-md border p-2 text-sm",
              "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
              appIcon === option.value ? "border-primary bg-accent" : "border-border",
            )}
          >
            <img src={option.src} alt="" width={PREVIEW_SIZE_PX} height={PREVIEW_SIZE_PX} />
            <span className="flex items-center gap-1.5">
              <input
                type="radio"
                name={name}
                value={option.value}
                className="size-4 accent-primary focus-visible:outline-none"
                checked={appIcon === option.value}
                onChange={() => {
                  change((current) => ({ ...current, appIcon: option.value }));
                }}
              />
              {option.label}
            </span>
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Shown on the taskbar, in Alt+Tab and in the title bar of task windows. The installed
        program, its shortcuts and the macOS Dock keep the golden icon.
      </p>
    </fieldset>
  );
}

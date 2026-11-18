import { useId } from "react";

import type { AppIcon } from "@/shared/ipc/bindings";
import { cn } from "@/shared/lib/cn";
import { isMacPlatform, isWindowsPlatform } from "@/shared/lib/platform";

import { useAppSettings, useChangeSettings } from "../hooks/useAppSettings";

/** Shown at this size, as a taskbar would at high scaling. */
const PREVIEW_SIZE_PX = 48;

interface IconOption {
  value: AppIcon;
  label: string;
  src: string;
}

/** Windows and Linux: three icons, previewed with the Windows pictures. */
const DESKTOP_ICONS: readonly IconOption[] = [
  { value: "cream", label: "Cream", src: "/icon.png" },
  { value: "vibrant", label: "Vibrant", src: "/icon-vibrant.png" },
  { value: "free", label: "Free", src: "/icon-free.png" },
];

/** macOS: its own pictures, and no icon without a background (Free shows as cream). */
const MAC_ICONS: readonly IconOption[] = [
  { value: "cream", label: "Cream", src: "/icon-mac-cream.png" },
  { value: "vibrant", label: "Vibrant", src: "/icon-mac-vibrant.png" },
];

function whereShown(): string {
  if (isMacPlatform()) {
    return "Shown in the Dock while NoBlame runs. When NoBlame is closed, the Dock and Finder show the cream icon.";
  }
  if (isWindowsPlatform()) {
    return "Shown on the taskbar, in Alt+Tab and in the title bar of task windows. The installed program and its shortcuts keep the cream icon.";
  }
  return "Shown as the icon of NoBlame's windows. The installed program keeps the cream icon.";
}

/** Which icon the app shows (the choices depend on the system). */
export function AppIconChoice() {
  const name = useId();
  const isMac = isMacPlatform();
  const options = isMac ? MAC_ICONS : DESKTOP_ICONS;
  const saved = useAppSettings().appIcon;
  const appIcon = isMac && saved === "free" ? "cream" : saved;
  const change = useChangeSettings();
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">App icon</legend>
      <div className="flex gap-3">
        {options.map((option) => (
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
      <p className="text-xs text-muted-foreground">{whereShown()}</p>
    </fieldset>
  );
}

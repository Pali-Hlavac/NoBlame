import type { ReactNode } from "react";

import { isMacPlatform } from "@/shared/lib/platform";

import { WindowControls } from "./WindowControls";

/** Room for the macOS traffic lights, which sit over the left end of the title bar. */
const MAC_TRAFFIC_LIGHTS_WIDTH = "w-20";

interface TitleBarProps {
  /** Controls after the app icon (the toolbar). */
  start?: ReactNode;
  /** Controls before the window buttons (status, search). */
  end?: ReactNode;
}

/**
 * The main window's own title bar. Empty space drags the window and a double click maximizes
 * it (`data-tauri-drag-region` works on the element itself, not its children, so every filler
 * carries it). Controls are laid out by the caller.
 */
export function TitleBar({ start, end }: TitleBarProps) {
  const mac = isMacPlatform();
  return (
    <header
      data-tauri-drag-region
      className="@container flex h-9 shrink-0 items-center border-b border-border bg-muted/60 select-none"
    >
      {mac ? (
        <div data-tauri-drag-region className={`${MAC_TRAFFIC_LIGHTS_WIDTH} h-full shrink-0`} />
      ) : (
        <img src="/icon.svg" alt="" data-tauri-drag-region className="mx-3 size-4 shrink-0" />
      )}
      {start}
      <div data-tauri-drag-region className="h-full min-w-4 flex-1" />
      <div data-tauri-drag-region className="flex min-w-0 items-center gap-1 pr-1">
        {end}
      </div>
      {!mac && <WindowControls />}
    </header>
  );
}

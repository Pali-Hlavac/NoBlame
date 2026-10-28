import { getCurrentWindow } from "@tauri-apps/api/window";
import { CopyIcon, MinusIcon, SquareIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/shared/lib/cn";

const BUTTON =
  "flex h-full w-11 items-center justify-center text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset";

function report(action: string) {
  return (error: unknown) => {
    console.warn(`Could not ${action} the window`, error);
  };
}

/** Minimize, maximize/restore and close, for the undecorated main window (not on macOS). */
export function WindowControls() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const window = getCurrentWindow();
    const update = (): void => {
      window.isMaximized().then(setMaximized, report("read the state of"));
    };
    update();
    const unlisten = window.onResized(update);
    return () => {
      void unlisten.then((stop) => {
        stop();
      });
    };
  }, []);

  const MaximizeIcon = maximized ? CopyIcon : SquareIcon;
  return (
    <div className="flex h-full shrink-0">
      <button
        aria-label="Minimize"
        className={BUTTON}
        onClick={() => {
          getCurrentWindow().minimize().catch(report("minimize"));
        }}
      >
        <MinusIcon className="size-4" aria-hidden />
      </button>
      <button
        aria-label={maximized ? "Restore" : "Maximize"}
        className={BUTTON}
        onClick={() => {
          getCurrentWindow().toggleMaximize().catch(report("maximize"));
        }}
      >
        <MaximizeIcon className={cn("size-3.5", maximized && "-scale-x-100")} aria-hidden />
      </button>
      <button
        aria-label="Close"
        className={cn(BUTTON, "hover:bg-destructive hover:text-destructive-foreground")}
        onClick={() => {
          getCurrentWindow().close().catch(report("close"));
        }}
      >
        <XIcon className="size-4" aria-hidden />
      </button>
    </div>
  );
}

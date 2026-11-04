import { PanelLeftIcon, XIcon } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/shared/lib/cn";
import { kindIconClass } from "@/shared/lib/workKinds";
import { Button } from "@/shared/ui/button";

import { ModuleHostContext, type ModuleHost } from "../hooks/useModuleHost";
import { closeModulePopup, dockModule } from "../lib/popups";
import { useWorkbenchStore } from "../store/workbench";
import type { WorkbenchModule } from "../types";

const POPUP_HOST: ModuleHost = { placement: "popup", close: closeModulePopup };

/** Esc anywhere (focus may be on the page after a dialog inside closed) closes the popup. */
function onKeyDown(event: KeyboardEvent): void {
  // A menu or dialog inside the module closes first (it marks Esc as handled).
  if (event.key !== "Escape" || event.defaultPrevented) return;
  event.preventDefault();
  closeModulePopup();
}

/**
 * One popped-out module over the window. Stays mounted while hidden, so the module keeps what
 * the user typed or chose until it is shown again.
 */
function ModulePopup({ module, open }: { module: WorkbenchModule; open: boolean }) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const Icon = module.icon;
  const Content = module.component;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.current?.focus();
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (previous?.isConnected) previous.focus();
    };
  }, [open]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[1px]",
        !open && "hidden",
      )}
    >
      <div
        ref={panel}
        // Only an open popup counts as a dialog (global shortcuts pause while one is open).
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "flex h-[85vh] flex-col overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg outline-none",
          module.popupWide ? "w-[min(80rem,95vw)]" : "w-[min(36rem,95vw)]",
        )}
      >
        <header className="flex shrink-0 items-center gap-2 border-b border-border py-1 pr-1 pl-3">
          <Icon aria-hidden className={cn("size-4", kindIconClass(module.kind))} />
          <h2 id={titleId} className="min-w-0 flex-1 truncate text-sm font-semibold">
            {module.title}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            title="Put it back in the sidebar"
            onClick={() => {
              dockModule(module.id);
            }}
          >
            <PanelLeftIcon aria-hidden />
            Dock
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close"
            title="Close (Esc)"
            onClick={closeModulePopup}
          >
            <XIcon aria-hidden />
          </Button>
        </header>
        <div className="min-h-0 flex-1 overflow-hidden bg-muted/30">
          <ModuleHostContext.Provider value={POPUP_HOST}>
            <Content />
          </ModuleHostContext.Provider>
        </div>
      </div>
    </div>
  );
}

/**
 * The popups of popped-out modules, over everything (the window behind is inert while one is
 * open, see `useModulePopupOpen`).
 */
export function ModulePopups({ modules }: { modules: readonly WorkbenchModule[] }) {
  const mounted = useWorkbenchStore((state) => state.mountedPopups);
  const popup = useWorkbenchStore((state) => state.popup);
  const popups = mounted.flatMap((id) => modules.find((module) => module.id === id) ?? []);
  return createPortal(
    popups.map((module) => (
      <ModulePopup key={module.id} module={module} open={popup === module.id} />
    )),
    document.body,
  );
}

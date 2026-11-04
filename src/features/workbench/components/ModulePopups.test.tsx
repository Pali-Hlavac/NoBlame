import { act, fireEvent, render, screen } from "@testing-library/react";
import { BoxIcon } from "lucide-react";

import { useModuleHost } from "../hooks/useModuleHost";
import { docks, openModule } from "../lib/docks";
import { dockModule, popOutModule } from "../lib/popups";
import { useWorkbenchStore } from "../store/workbench";
import type { WorkbenchModule } from "../types";
import { ModulePopups } from "./ModulePopups";

function Notes() {
  const host = useModuleHost();
  return <input aria-label={`Notes in the ${host.placement}`} />;
}

const NOTES: WorkbenchModule = { id: "notes", title: "Notes", icon: BoxIcon, component: Notes };

describe("ModulePopups", () => {
  beforeEach(() => {
    act(() => {
      useWorkbenchStore.getState().resetLayout();
    });
    docks.registered = [NOTES];
  });

  it("opens a popped-out module in its popup, also when opened again", () => {
    render(<ModulePopups modules={[NOTES]} />);
    act(() => {
      popOutModule(NOTES.id);
    });
    expect(screen.getByRole("dialog", { name: "Notes" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Notes in the popup" })).toBeVisible();

    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();

    act(() => {
      openModule(NOTES);
    });
    expect(screen.getByRole("dialog", { name: "Notes" })).toBeVisible();
    expect(useWorkbenchStore.getState().sidebarCollapsed).toBe(false);
  });

  it("keeps what was typed after closing", () => {
    render(<ModulePopups modules={[NOTES]} />);
    act(() => {
      popOutModule(NOTES.id);
    });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "half a message" } });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    act(() => {
      openModule(NOTES);
    });
    expect(screen.getByRole("textbox")).toHaveValue("half a message");
  });

  it("docks the module back", () => {
    render(<ModulePopups modules={[NOTES]} />);
    act(() => {
      popOutModule(NOTES.id);
    });
    fireEvent.click(screen.getByRole("button", { name: "Dock" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(useWorkbenchStore.getState().poppedOut).toEqual([]);
    act(() => {
      dockModule(NOTES.id);
      openModule(NOTES);
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

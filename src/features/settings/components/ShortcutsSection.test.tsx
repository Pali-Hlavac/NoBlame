import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { Settings } from "@/shared/ipc/bindings";
import { keysOf, setUserKeybindings } from "@/shared/lib/keybindings";

import { useSettings } from "../api/settings";
import { KeybindingsController } from "./KeybindingsController";
import { ShortcutsSection } from "./ShortcutsSection";

const ipc = vi.hoisted(() => ({ getSettings: vi.fn(), updateSettings: vi.fn() }));
vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc }));

const lastSaved = () => ipc.updateSettings.mock.calls.at(-1)?.[0] as Settings | undefined;

function Harness() {
  return useSettings().isSuccess ? (
    <>
      <KeybindingsController />
      <ShortcutsSection />
    </>
  ) : null;
}

function renderSection(saved: Settings = {}) {
  ipc.getSettings.mockResolvedValue({ status: "ok", data: saved });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <Harness />
    </QueryClientProvider>,
  );
}

describe("ShortcutsSection", () => {
  beforeEach(() => {
    ipc.updateSettings.mockImplementation((settings: Settings) =>
      Promise.resolve({ status: "ok", data: settings }),
    );
  });
  afterEach(() => {
    setUserKeybindings([]);
  });

  it("records new keys, saves them and applies them at once", async () => {
    const user = userEvent.setup();
    renderSection();
    await user.click(
      await screen.findByRole("button", {
        name: "Change the shortcut of Find commits, now Ctrl+F",
      }),
    );
    expect(screen.getByText("Esc cancels, Backspace removes the shortcut.")).toBeInTheDocument();
    await user.keyboard("{Control>}{Alt>}f{/Alt}{/Control}");
    await waitFor(() => {
      expect(lastSaved()?.keybindings).toEqual([{ id: "history.find", keys: "mod+alt+f" }]);
    });
    expect(keysOf("history.find")).toBe("mod+alt+f");
    expect(
      screen.getByRole("button", { name: "Change the shortcut of Find commits, now Ctrl+Alt+F" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset all shortcuts (1 changed)" })).toBeVisible();
  });

  it("says why keys are refused and keeps recording", async () => {
    const user = userEvent.setup();
    renderSection();
    await user.click(
      await screen.findByRole("button", { name: /Change the shortcut of Find commits/ }),
    );
    await user.keyboard("{Control>}k{/Control}");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Ctrl+K is already the shortcut of “Command palette” (General).",
    );
    await user.keyboard("g");
    expect(screen.getByRole("alert")).toHaveTextContent(/would be typed in text fields/);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(ipc.updateSettings).not.toHaveBeenCalled();
  });

  it("removes a shortcut with Backspace and resets one changed before", async () => {
    const user = userEvent.setup();
    renderSection({ keybindings: [{ id: "tabs.close", keys: "alt+w" }] });
    const tabs = await screen.findByRole("list", { name: "Tabs shortcuts" });
    await user.click(within(tabs).getByRole("button", { name: "Reset Close the tab to Ctrl+W" }));
    await waitFor(() => {
      expect(lastSaved()?.keybindings).toEqual([]);
    });
    await user.click(within(tabs).getByRole("button", { name: /Change the shortcut of Next tab/ }));
    await user.keyboard("{Backspace}");
    await waitFor(() => {
      expect(lastSaved()?.keybindings).toEqual([{ id: "tabs.next", keys: "" }]);
    });
    expect(
      within(tabs).getByRole("button", {
        name: "Change the shortcut of Next tab, now no shortcut",
      }),
    ).toHaveTextContent("None");
  });
});

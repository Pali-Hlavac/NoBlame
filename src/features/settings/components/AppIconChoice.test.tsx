import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { Settings } from "@/shared/ipc/bindings";

import { useSettings } from "../api/settings";
import { AppIconChoice } from "./AppIconChoice";

const ipc = vi.hoisted(() => ({ getSettings: vi.fn(), updateSettings: vi.fn() }));
vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc }));

const platform = vi.hoisted(() => ({ mac: false }));
vi.mock("@/shared/lib/platform", () => ({
  isMacPlatform: () => platform.mac,
  isWindowsPlatform: () => !platform.mac,
}));

function Harness() {
  return useSettings().isSuccess ? <AppIconChoice /> : null;
}

function renderWith(settings: Partial<Settings>) {
  ipc.getSettings.mockResolvedValue({ status: "ok", data: settings });
  ipc.updateSettings.mockImplementation((saved: Settings) =>
    Promise.resolve({ status: "ok", data: saved }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <Harness />
    </QueryClientProvider>,
  );
}

describe("AppIconChoice", () => {
  beforeEach(() => {
    platform.mac = false;
  });

  it("starts cream and saves the vibrant icon when chosen", async () => {
    const user = userEvent.setup();
    renderWith({});
    expect(await screen.findByRole("radio", { name: "Cream" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Free" })).not.toBeChecked();
    await user.click(screen.getByRole("radio", { name: "Vibrant" }));
    await waitFor(() => {
      expect(ipc.updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({ appIcon: "vibrant" }),
      );
    });
    expect(screen.getByRole("radio", { name: "Vibrant" })).toBeChecked();
  });

  it("offers only cream and vibrant on macOS, where free shows as cream", async () => {
    platform.mac = true;
    renderWith({ appIcon: "free" });
    expect(await screen.findByRole("radio", { name: "Cream" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Vibrant" })).not.toBeChecked();
    expect(screen.queryByRole("radio", { name: "Free" })).toBeNull();
    expect(screen.getByText(/Shown in the Dock/)).toBeInTheDocument();
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { Settings } from "@/shared/ipc/bindings";

import { useSettings } from "../api/settings";
import { AppIconChoice } from "./AppIconChoice";

const ipc = vi.hoisted(() => ({ getSettings: vi.fn(), updateSettings: vi.fn() }));
vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc }));

function Harness() {
  return useSettings().isSuccess ? <AppIconChoice /> : null;
}

describe("AppIconChoice", () => {
  it("starts golden and saves the vibrant icon when chosen", async () => {
    const user = userEvent.setup();
    ipc.getSettings.mockResolvedValue({ status: "ok", data: {} });
    ipc.updateSettings.mockImplementation((settings: Settings) =>
      Promise.resolve({ status: "ok", data: settings }),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <Harness />
      </QueryClientProvider>,
    );
    expect(await screen.findByRole("radio", { name: "Golden" })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: "Vibrant" }));
    await waitFor(() => {
      expect(ipc.updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({ appIcon: "vibrant" }),
      );
    });
    expect(screen.getByRole("radio", { name: "Vibrant" })).toBeChecked();
  });
});

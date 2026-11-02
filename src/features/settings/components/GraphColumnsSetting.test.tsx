import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { Settings } from "@/shared/ipc/bindings";

import { useSettings } from "../api/settings";
import { GraphColumnsSetting } from "./GraphColumnsSetting";

const ipc = vi.hoisted(() => ({ getSettings: vi.fn(), updateSettings: vi.fn() }));
vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc }));

const lastSaved = () => ipc.updateSettings.mock.calls.at(-1)?.[0] as Settings | undefined;

function Harness() {
  return useSettings().isSuccess ? <GraphColumnsSetting /> : null;
}

describe("GraphColumnsSetting", () => {
  beforeEach(() => {
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
  });

  it("moves columns but never above the graph", async () => {
    const user = userEvent.setup();
    expect(await screen.findByRole("button", { name: "Move Message up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Graph down" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Move Date up" }));
    await waitFor(() => {
      expect(lastSaved()?.graph?.columns?.map((column) => column.id)).toEqual([
        "graph",
        "message",
        "date",
        "author",
        "commit",
      ]);
    });
  });

  it("switches dates to relative", async () => {
    const user = userEvent.setup();
    await user.click(await screen.findByRole("radio", { name: "Time since (3 h ago)" }));
    await waitFor(() => {
      expect(lastSaved()?.graph?.dateDisplay).toBe("relative");
    });
    expect(screen.getByRole("checkbox", { name: "Message" })).toBeDisabled();
  });
});

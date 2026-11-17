import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

import { useUpdatesStore } from "../store/updates";
import { UpdateCheck } from "./UpdateCheck";
import { UpdateDialog } from "./UpdateDialog";

const ipc = vi.hoisted(() => ({
  getUpdateSupport: vi.fn(),
  checkForUpdate: vi.fn(),
  installUpdate: vi.fn(),
}));
vi.mock("@/shared/ipc/bindings", () => ({
  commands: ipc,
  events: { updateProgress: { listen: () => Promise.resolve(() => undefined) } },
}));

const UPDATE = {
  version: "0.2.0",
  currentVersion: "0.1.0",
  notes: "Faster graphs.",
};

function renderWith(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

describe("updates", () => {
  beforeEach(() => {
    useUpdatesStore.setState({ available: null, dialogOpen: false });
  });

  it("says a build from source does not update itself", async () => {
    ipc.getUpdateSupport.mockResolvedValue({ configured: false, currentVersion: "0.1.0" });
    renderWith(<UpdateCheck />);
    expect(await screen.findByText(/does not update itself/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Check for updates" })).toBeNull();
  });

  it("checks, says when this is the newest version", async () => {
    const user = userEvent.setup();
    ipc.getUpdateSupport.mockResolvedValue({ configured: true, currentVersion: "0.1.0" });
    ipc.checkForUpdate.mockResolvedValue({ status: "ok", data: null });
    renderWith(<UpdateCheck />);
    await user.click(await screen.findByRole("button", { name: "Check for updates" }));
    expect(await screen.findByRole("status")).toHaveTextContent("You have the newest version.");
  });

  it("offers a newer release with its notes and installs it", async () => {
    const user = userEvent.setup();
    ipc.getUpdateSupport.mockResolvedValue({ configured: true, currentVersion: "0.1.0" });
    ipc.checkForUpdate.mockResolvedValue({ status: "ok", data: UPDATE });
    ipc.installUpdate.mockReturnValue(new Promise(() => undefined));
    renderWith(
      <>
        <UpdateCheck />
        <UpdateDialog />
      </>,
    );
    await user.click(await screen.findByRole("button", { name: "Check for updates" }));
    const dialog = await screen.findByRole("dialog", { name: "NoBlame 0.2.0 is available" });
    expect(dialog).toHaveTextContent("You have 0.1.0.");
    expect(screen.getByRole("region", { name: "What is new" })).toHaveTextContent("Faster graphs.");
    await user.click(screen.getByRole("button", { name: "Install and restart" }));
    expect(ipc.installUpdate).toHaveBeenCalled();
    expect(await screen.findByRole("button", { name: "Installing…" })).toBeDisabled();
    expect(screen.getByRole("progressbar", { name: "Downloading the update" })).toBeVisible();
  });
});

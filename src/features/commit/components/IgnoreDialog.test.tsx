import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { IgnoreDialog } from "./IgnoreDialog";

const ipc = vi.hoisted(() => ({
  previewIgnore: vi.fn(),
  ignoreFiles: vi.fn(),
}));

vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc }));

function renderDialog(onClose = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <IgnoreDialog repoId={1} path="logs/today.log" onClose={onClose} />
    </QueryClientProvider>,
  );
  return onClose;
}

describe("IgnoreDialog", () => {
  beforeEach(() => {
    ipc.previewIgnore.mockImplementation((_id: number, pattern: string) =>
      Promise.resolve({
        status: "ok",
        data:
          pattern === "*.log"
            ? { files: ["build.log", "logs/today.log"], total: 2 }
            : { files: ["logs/today.log"], total: 1 },
      }),
    );
    ipc.ignoreFiles.mockResolvedValue({ status: "ok", data: true });
  });

  it("starts with the file itself and shows what the pattern hides", async () => {
    renderDialog();
    expect(screen.getByRole("textbox", { name: "Pattern" })).toHaveValue("/logs/today.log");
    expect(screen.getByRole("radio", { name: /Only this file/ })).toBeChecked();
    expect(await screen.findByText(/Hides 1 file listed now/)).toBeVisible();
    expect(ipc.previewIgnore).toHaveBeenCalledWith(1, "/logs/today.log");
  });

  it("adds the chosen pattern to the chosen file", async () => {
    const user = userEvent.setup();
    const onClose = renderDialog();
    await user.click(screen.getByRole("radio", { name: /Every \.log file/ }));
    expect(screen.getByRole("textbox", { name: "Pattern" })).toHaveValue("*.log");
    expect(await screen.findByText(/Hides 2 files listed now/)).toBeVisible();
    expect(screen.getByRole("list", { name: "Files it hides" })).toHaveTextContent("build.log");
    await user.click(screen.getByRole("radio", { name: /info\/exclude/ }));
    await user.click(screen.getByRole("button", { name: "Ignore" }));
    expect(ipc.ignoreFiles).toHaveBeenCalledWith(1, { pattern: "*.log", file: "local" });
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("takes a typed pattern, leaving every choice unpicked", async () => {
    const user = userEvent.setup();
    renderDialog();
    const input = screen.getByRole("textbox", { name: "Pattern" });
    await user.clear(input);
    await user.type(input, "logs/*.tmp");
    for (const radio of screen.getAllByRole("radio").slice(0, 4)) {
      expect(radio).not.toBeChecked();
    }
    await waitFor(() => {
      expect(ipc.previewIgnore).toHaveBeenLastCalledWith(1, "logs/*.tmp");
    });
  });
});

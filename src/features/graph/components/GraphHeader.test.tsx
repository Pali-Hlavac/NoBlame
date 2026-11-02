import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { useSettings } from "@/features/settings";
import type { GraphColumn, Settings } from "@/shared/ipc/bindings";

import { useColumnLayout } from "../hooks/useColumnLayout";
import { GraphHeader } from "./GraphHeader";

const ipc = vi.hoisted(() => ({ getSettings: vi.fn(), updateSettings: vi.fn() }));
vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc }));

/** The columns last sent to `update_settings`. */
const savedColumns = (): GraphColumn[] =>
  (ipc.updateSettings.mock.calls.at(-1)?.[0] as Settings | undefined)?.graph?.columns ?? [];
const savedIds = () => savedColumns().map((column) => column.id);

function Header() {
  const { layout, actions } = useColumnLayout(2000, 60);
  return <GraphHeader columns={layout} actions={actions} />;
}

/** Changes are ignored until the settings are loaded, as in the app. */
function Harness() {
  return useSettings().isSuccess ? <Header /> : null;
}

function renderHeader() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <Harness />
    </QueryClientProvider>,
  );
}

/** A stand-in for the browser's DataTransfer (jsdom has none). */
function dataTransfer() {
  const data = new Map<string, string>();
  return {
    get types() {
      return [...data.keys()];
    },
    setData: (type: string, value: string) => data.set(type, value),
    getData: (type: string) => data.get(type) ?? "",
    effectAllowed: "all",
    dropEffect: "none",
  };
}

describe("GraphHeader", () => {
  beforeEach(() => {
    ipc.getSettings.mockResolvedValue({ status: "ok", data: {} });
    ipc.updateSettings.mockImplementation((settings: Settings) =>
      Promise.resolve({ status: "ok", data: settings }),
    );
  });

  it("hides a column from the columns menu and keeps the message", async () => {
    const user = userEvent.setup();
    renderHeader();
    await user.click(await screen.findByRole("button", { name: "Columns" }));
    expect(screen.getByRole("menuitemcheckbox", { name: "Message" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await user.click(screen.getByRole("menuitemcheckbox", { name: "Author" }));
    await waitFor(() => {
      expect(savedColumns().find((column) => column.id === "author")?.visible).toBe(false);
    });
  });

  it("resizes a column with the arrow keys and resets it with Delete", async () => {
    const user = userEvent.setup();
    renderHeader();
    const edge = await screen.findByRole("separator", { name: "Width of the Date column" });
    edge.focus();
    await user.keyboard("{ArrowRight}");
    await waitFor(() => {
      expect(savedColumns().find((column) => column.id === "date")?.width).toBe(158);
    });
    await user.keyboard("{Delete}");
    await waitFor(() => {
      expect(savedColumns().find((column) => column.id === "date")?.width).toBeNull();
    });
  });

  it("moves a column dropped on another one's left half before it", async () => {
    renderHeader();
    const commit = await screen.findByText("Commit");
    const message = screen.getByText("Message");
    const transfer = dataTransfer();
    fireEvent.dragStart(commit, { dataTransfer: transfer });
    // jsdom lays nothing out: every rectangle is 0 wide, so clientX 0 is the left half.
    fireEvent.dragOver(message, { dataTransfer: transfer, clientX: -1 });
    fireEvent.drop(message, { dataTransfer: transfer, clientX: -1 });
    await waitFor(() => {
      expect(savedIds()).toEqual(["graph", "commit", "message", "author", "date"]);
    });
  });
});

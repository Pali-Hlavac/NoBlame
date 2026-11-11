import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { keyProblem, settingValue } from "../lib/gitConfig";
import { GitConfigSection } from "./GitConfigSection";

const ipc = vi.hoisted(() => ({
  getGitConfig: vi.fn(),
  setGitConfig: vi.fn(),
  unsetGitConfig: vi.fn(),
}));

vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc }));
vi.mock("@/features/repositories", () => ({
  useActiveRepository: () => ({ summary: { id: 1, name: "app" } }),
}));

function ok<T>(data: T) {
  return Promise.resolve({ status: "ok" as const, data });
}

function renderSection() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <GitConfigSection />
    </QueryClientProvider>,
  );
}

describe("Git settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ipc.setGitConfig.mockReturnValue(ok(null));
  });

  it("names the file and saves a common setting in the repository's file", async () => {
    const user = userEvent.setup();
    ipc.getGitConfig.mockImplementation((_id: number, scope: string) =>
      ok(
        scope === "local"
          ? {
              path: ".git/config",
              entries: [
                { key: "user.email", value: "ada@work.example" },
                { key: "core.bare", value: "false" },
              ],
            }
          : { path: null, entries: [] },
      ),
    );
    renderSection();
    expect(await screen.findByText("File: .git/config")).toBeVisible();
    const email = screen.getByLabelText("Value of user.email");
    expect(email).toHaveValue("ada@work.example");
    const others = screen.getByRole("list", { name: "Other settings" });
    expect(within(others).getByText("core.bare")).toBeVisible();
    await user.clear(email);
    await user.type(email, "ada@example.com");
    const row = email.closest("li");
    if (!row) throw new Error("no row");
    await user.click(within(row).getByRole("button", { name: "Save" }));
    expect(ipc.setGitConfig).toHaveBeenCalledWith(1, "local", "user.email", "ada@example.com");

    await user.click(screen.getByLabelText("Your user settings"));
    await waitFor(() => {
      expect(screen.getByText(/file does not exist yet/)).toBeVisible();
    });
    await user.type(screen.getByLabelText("New setting name"), "alias.st");
    await user.type(screen.getByLabelText("New setting value"), "status -sb");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(ipc.setGitConfig).toHaveBeenLastCalledWith(1, "global", "alias.st", "status -sb");
  });

  it("checks names and finds values", () => {
    expect(keyProblem("user.name")).toBeNull();
    expect(keyProblem("user")).toMatch(/look like/);
    expect(settingValue([{ key: "core.autocrlf", value: "true" }], "core.autoCRLF")).toBe("true");
  });
});

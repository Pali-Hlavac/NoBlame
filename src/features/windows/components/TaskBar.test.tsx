import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TaskBar } from "./TaskBar";

const ipc = vi.hoisted(() => ({ openInMainWindow: vi.fn() }));
vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc }));

describe("TaskBar", () => {
  beforeEach(() => {
    ipc.openInMainWindow.mockResolvedValue({ status: "ok", data: null });
  });

  it("names the task, the repository and the folder it shows", () => {
    render(
      <TaskBar
        task="log"
        path="/work/app/src/deep"
        repository={{ name: "app", path: "/work/app" }}
        scope="src/deep"
      />,
    );
    const bar = screen.getByRole("banner", { name: "Task" });
    expect(bar).toHaveTextContent("Log");
    expect(bar).toHaveTextContent("app");
    expect(bar).toHaveTextContent("src/deep");
  });

  it("opens the whole repository in the main window", async () => {
    const user = userEvent.setup();
    render(
      <TaskBar task="log" path="/work/app/src" repository={{ name: "app", path: "/work/app" }} />,
    );
    await user.click(screen.getByRole("button", { name: "Open in NoBlame" }));
    expect(ipc.openInMainWindow).toHaveBeenCalledWith("/work/app");
  });

  it("shows the path given while the repository is still opening", () => {
    render(<TaskBar task="commit" path="/work/app" />);
    expect(screen.getByRole("banner", { name: "Task" })).toHaveTextContent("Commit/work/app");
  });
});

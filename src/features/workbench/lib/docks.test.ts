import { keepLayout, resetLayout, scheduleLayoutSave } from "./docks";

const ipc = vi.hoisted(() => ({ saveWorkbenchLayout: vi.fn() }));
vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc }));

/** Longer than the delay after the last change. */
const AFTER_SAVE_DELAY_MS = 1_000;

describe("saving the layout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    ipc.saveWorkbenchLayout.mockResolvedValue({ status: "ok", data: null });
  });
  afterEach(() => {
    keepLayout(true);
    vi.useRealTimers();
  });

  it("saves the main window's layout shortly after a change", () => {
    keepLayout(true);
    scheduleLayoutSave();
    vi.advanceTimersByTime(AFTER_SAVE_DELAY_MS);
    expect(ipc.saveWorkbenchLayout).toHaveBeenCalledTimes(1);
  });

  it("never saves a task window's layout, nor forgets the saved one", async () => {
    keepLayout(false);
    scheduleLayoutSave();
    vi.advanceTimersByTime(AFTER_SAVE_DELAY_MS);
    await resetLayout();
    expect(ipc.saveWorkbenchLayout).not.toHaveBeenCalled();
  });
});

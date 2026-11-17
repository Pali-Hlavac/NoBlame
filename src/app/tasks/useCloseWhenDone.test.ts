import { act, renderHook } from "@testing-library/react";

import { actionDone } from "@/shared/lib/actionDone";

import { CLOSE_AFTER_SUCCESS_MS, useCloseWhenDone } from "./useCloseWhenDone";

const mocks = vi.hoisted(() => ({ close: vi.fn(), closeAfterSuccess: false }));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: () => ({ close: mocks.close }) }));
vi.mock("@/features/settings", () => ({
  useAppSettings: () => ({ taskWindows: { closeAfterSuccess: mocks.closeAfterSuccess } }),
}));

describe("closing a task window once its action succeeded", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.close.mockReset().mockResolvedValue(undefined);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("closes the Commit window a moment after a commit, when the setting is on", () => {
    mocks.closeAfterSuccess = true;
    renderHook(() => {
      useCloseWhenDone("commit");
    });
    act(() => {
      actionDone("commit");
    });
    expect(mocks.close).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(CLOSE_AFTER_SUCCESS_MS);
    });
    expect(mocks.close).toHaveBeenCalledTimes(1);
  });

  it("leaves it open for another window's action, and when the setting is off", () => {
    mocks.closeAfterSuccess = true;
    const { unmount } = renderHook(() => {
      useCloseWhenDone("pull");
    });
    act(() => {
      actionDone("commit");
      vi.advanceTimersByTime(CLOSE_AFTER_SUCCESS_MS);
    });
    unmount();
    mocks.closeAfterSuccess = false;
    renderHook(() => {
      useCloseWhenDone("pull");
    });
    act(() => {
      actionDone("pull");
      vi.advanceTimersByTime(CLOSE_AFTER_SUCCESS_MS);
    });
    expect(mocks.close).not.toHaveBeenCalled();
  });
});

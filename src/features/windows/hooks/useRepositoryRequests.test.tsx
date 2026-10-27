import { renderHook, waitFor } from "@testing-library/react";

import { useRepositoryRequests } from "./useRepositoryRequests";

const queue = vi.hoisted(() => ({ paths: [] as string[] }));

vi.mock("@/shared/ipc/bindings", () => ({
  commands: {
    takeRepositoryRequests: () => {
      const taken = queue.paths;
      queue.paths = [];
      return Promise.resolve(taken);
    },
  },
  events: { repositoriesRequested: { listen: () => Promise.resolve(() => undefined) } },
}));

describe("useRepositoryRequests", () => {
  it("delivers the paths that started the app", async () => {
    queue.paths = ["/repos/linux"];
    const onRequest = vi.fn();
    renderHook(() => {
      useRepositoryRequests(onRequest);
    });
    await waitFor(() => {
      expect(onRequest).toHaveBeenCalledWith(["/repos/linux"]);
    });
  });

  // Regression: taking the requests empties the backend queue. When the effect was cleaned up
  // before the answer arrived (React StrictMode does exactly that in development), the paths
  // were dropped and `noblame <path>` opened no tab.
  it("still delivers paths taken just before the effect was cleaned up", async () => {
    queue.paths = ["/repos/linux"];
    const onRequest = vi.fn();
    const { unmount } = renderHook(() => {
      useRepositoryRequests(onRequest);
    });
    unmount();
    await waitFor(() => {
      expect(onRequest).toHaveBeenCalledWith(["/repos/linux"]);
    });
  });
});

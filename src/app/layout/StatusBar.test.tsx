import { QueryClient, QueryClientProvider, useMutation } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import { useEffect } from "react";

import { StatusBar } from "./StatusBar";

const ipc = vi.hoisted(() => ({
  listJobs: vi.fn(() => Promise.resolve([])),
  getAppInfo: vi.fn(() => Promise.resolve({ name: "NoBlame", version: "0.1.0" })),
}));

vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc, events: {} }));
vi.mock("@/features/about", () => ({
  useAppInfo: () => ({ data: { name: "NoBlame", version: "0.1.0" } }),
}));
vi.mock("@/features/git-env", () => ({ GitStatusButton: () => null }));
vi.mock("@/features/settings", () => ({ ThemeMenu: () => null }));
vi.mock("@/features/jobs", async () => {
  const { useQuery } = await import("@tanstack/react-query");
  return {
    JobsIndicator: () => null,
    useJobs: () => useQuery({ queryKey: ["jobs"], queryFn: () => ipc.listJobs() }),
  };
});

/** Runs a change that never ends, as a checkout that takes a while. */
function SlowCheckout() {
  const { mutate } = useMutation({
    mutationFn: () => new Promise<void>(() => undefined),
    meta: { activity: "Checking out the branch" },
  });
  useEffect(() => {
    mutate();
  }, [mutate]);
  return null;
}

describe("the status bar", () => {
  it("names a change that runs for a moment, with a moving strip", async () => {
    vi.useFakeTimers();
    const client = new QueryClient();
    const { container } = render(
      <QueryClientProvider client={client}>
        <StatusBar />
        <SlowCheckout />
      </QueryClientProvider>,
    );
    // Not at once: quick changes would only flash.
    expect(screen.getByText("NoBlame 0.1.0")).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(screen.getByRole("status")).toHaveTextContent("Checking out the branch…");
    expect(container.querySelector(".animate-indeterminate")).not.toBeNull();
    vi.useRealTimers();
  });
});

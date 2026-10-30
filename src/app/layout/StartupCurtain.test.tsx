import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

import { StartupCurtain } from "./StartupCurtain";

/** A promise executor that never resolves. */
function neverSettles(): void {
  // Stays loading.
}

function withClient(client: QueryClient, children: ReactNode) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("StartupCurtain", () => {
  it("covers the window until it has rendered and nothing loads, then fades out", async () => {
    const client = new QueryClient();
    let finish: (() => void) | undefined;
    void client.query({
      queryKey: ["slow"],
      queryFn: () =>
        new Promise<number>((resolve) => {
          finish = () => {
            resolve(1);
          };
        }),
    });
    const { rerender } = render(withClient(client, <StartupCurtain rendered={false} />));
    expect(screen.getByRole("status")).toHaveTextContent("Starting…");

    rerender(withClient(client, <StartupCurtain rendered />));
    await act(() => vi.advanceTimersByTimeAsync(1_000));
    // Still loading: still covered.
    expect(screen.getByRole("status")).not.toHaveClass("opacity-0");

    await act(async () => {
      finish?.();
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(screen.getByRole("status")).toHaveClass("opacity-0");
    await act(() => vi.advanceTimersByTimeAsync(500));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("lifts after five seconds even if something still loads", async () => {
    const client = new QueryClient();
    void client.query({ queryKey: ["never"], queryFn: () => new Promise<number>(neverSettles) });
    render(withClient(client, <StartupCurtain rendered />));
    await act(() => vi.advanceTimersByTimeAsync(5_000));
    expect(screen.getByRole("status")).toHaveClass("opacity-0");
  });
});

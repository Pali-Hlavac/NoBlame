import { useEffect, useRef } from "react";

import { events } from "@/shared/ipc/bindings";
import { call, commands } from "@/shared/ipc/client";

/**
 * Calls `onRequest` with repositories requested from the command line: once on mount (for
 * `noblame <path>` that started the app) and whenever a later launch forwards a path.
 *
 * Taking the requests empties the backend queue, so a result is always delivered, even if the
 * effect was cleaned up meanwhile (React StrictMode runs effects twice in development).
 * `onRequest` must therefore be safe to call after unmount, e.g. by writing to a global store.
 */
export function useRepositoryRequests(onRequest: (paths: string[]) => void): void {
  const handlerRef = useRef(onRequest);

  useEffect(() => {
    handlerRef.current = onRequest;
  }, [onRequest]);

  useEffect(() => {
    const drain = async (): Promise<void> => {
      try {
        const paths = await call(commands.takeRepositoryRequests());
        if (paths.length > 0) handlerRef.current(paths);
      } catch (error) {
        console.error("Could not read repository requests", error);
      }
    };
    const unlisten = events.repositoriesRequested.listen(() => void drain());
    void drain();
    return () => {
      void unlisten.then((stop) => {
        stop();
      });
    };
  }, []);
}

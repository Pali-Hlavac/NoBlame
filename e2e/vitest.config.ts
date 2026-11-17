// End-to-end tests (`pnpm e2e`, see scripts/e2e.mjs): the real app driven through tauri-driver.
import { defineConfig } from "vitest/config";

/** Starting the app and git's work take seconds, not milliseconds. */
const TIMEOUT_MS = 120_000;

export default defineConfig({
  test: {
    include: ["e2e/**/*.e2e.ts"],
    globals: true,
    environment: "node",
    testTimeout: TIMEOUT_MS,
    hookTimeout: TIMEOUT_MS,
    // One app at a time: the tests share tauri-driver's port.
    fileParallelism: false,
  },
});

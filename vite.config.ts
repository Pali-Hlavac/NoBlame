// Vite config for the Tauri webview frontend and the Vitest test runner.
import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

import { LOADING_BIRD, startScreenHtml } from "./src/shared/lib/loadingBird";

/** Port Tauri expects the dev server on (see `build.devUrl` in tauri.conf.json). */
const DEV_SERVER_PORT = 1420;
const tauriDevHost = process.env.TAURI_DEV_HOST;

/**
 * Fills the start screen into index.html from the loading bird's settings (`loadingBird.ts`),
 * and preloads the picture first thing: in dev, hundreds of module requests would otherwise
 * delay it until the app has loaded.
 */
function startScreen(): Plugin {
  return {
    name: "noblame-start-screen",
    transformIndexHtml: (html) => ({
      html: html.replace("<!-- start-screen -->", startScreenHtml()),
      tags: [
        {
          tag: "link",
          attrs: {
            rel: "preload",
            href: LOADING_BIRD.image,
            as: "image",
            fetchpriority: "high",
          },
          injectTo: "head-prepend",
        },
      ],
    }),
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), startScreen()],
  clearScreen: false,
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    port: DEV_SERVER_PORT,
    strictPort: true,
    host: tauriDevHost ?? false,
    watch: { ignored: ["**/src-tauri/**", "**/crates/**", "**/target/**", "**/.cache/**"] },
  },
  envPrefix: ["VITE_", "TAURI_ENV_"],
  build: {
    target: "es2022",
    sourcemap: Boolean(process.env.TAURI_ENV_DEBUG),
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.mjs"],
    restoreMocks: true,
  },
});

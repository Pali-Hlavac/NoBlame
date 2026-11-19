// `pnpm e2e`: end-to-end smoke tests against the real app (ADR 0016). Prepares what they need,
// then runs `e2e/*.e2e.ts` with Vitest:
//
// - tauri-driver, built into `.cache/e2e/tools` (inside the repository: Windows Defender blocks
//   build scripts run from the temp folder);
// - on Windows, the Microsoft Edge WebDriver matching the installed WebView2, downloaded into
//   `.cache/e2e/`; on Linux, `WebKitWebDriver` must be on PATH (package webkit2gtk-driver);
// - a debug build of the app with the frontend built in, in `target/e2e` so it never replaces
//   the dev build (`pnpm e2e --no-build` reuses it).
//
// The app runs with its own profile (`NOBLAME_PROFILE_DIR`), so a running NoBlame and the
// user's settings are never touched. macOS has no WebDriver for its webview: not supported.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const TAURI_DRIVER_VERSION = "2.1.0";
const CACHE = resolve(".cache/e2e");
const isWindows = process.platform === "win32";
/** @param {string} name */
const exe = (name) => (isWindows ? `${name}.exe` : name);
const WEBVIEW2_KEY = "\\Microsoft\\EdgeUpdate\\Clients\\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}";

/**
 * @param {string} command
 * @param {string[]} args
 * @param {import("node:child_process").SpawnSyncOptions} [options]
 */
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: isWindows, ...options });
  if (result.status !== 0) {
    console.error(`\n${command} ${args.join(" ")} failed.`);
    process.exit(result.status ?? 1);
  }
}

function tauriDriver() {
  const binary = join(CACHE, "tools", "bin", exe("tauri-driver"));
  if (!existsSync(binary)) {
    console.log(`Building tauri-driver ${TAURI_DRIVER_VERSION} into ${CACHE}…`);
    run("cargo", [
      "install",
      "tauri-driver",
      "--version",
      TAURI_DRIVER_VERSION,
      "--locked",
      "--root",
      join(CACHE, "tools"),
      "--target-dir",
      join(CACHE, "cargo-target"),
    ]);
  }
  return binary;
}

/** The installed WebView2's version, from the registry (machine-wide, else the user's). */
function webView2Version() {
  for (const root of ["HKLM\\SOFTWARE\\WOW6432Node", "HKCU\\Software"]) {
    const query = spawnSync("reg", ["query", `${root}${WEBVIEW2_KEY}`, "/v", "pv"], {
      encoding: "utf8",
    });
    const version = /pv\s+REG_SZ\s+([\d.]+)/.exec(query.stdout ?? "")?.[1];
    if (version) return version;
  }
  console.error("WebView2 is not installed: NoBlame needs it to run.");
  process.exit(1);
}

/** The Edge WebDriver matching the installed WebView2 (Windows only). */
function edgeDriver() {
  const version = webView2Version();
  const folder = join(CACHE, `msedgedriver-${version}`);
  const binary = join(folder, "msedgedriver.exe");
  if (!existsSync(binary)) {
    mkdirSync(folder, { recursive: true });
    const zip = join(folder, "edgedriver_win64.zip");
    const url = `https://msedgedriver.microsoft.com/${version}/edgedriver_win64.zip`;
    console.log(`Downloading the Edge WebDriver ${version}…`);
    run("curl", ["-sSfL", "-o", zip, url], { shell: false });
    // Windows' own tar (bsdtar, Windows 10 and later) opens zip files; named by its full path so
    // Git's GNU tar on PATH is not taken. PowerShell's Expand-Archive broke on GitHub's runners.
    const tar = join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe");
    run(tar, ["-xf", zip, "-C", folder], { shell: false });
    rmSync(zip);
    if (!existsSync(binary)) {
      console.error(`The Edge WebDriver download did not contain ${binary}.`);
      process.exit(1);
    }
  }
  return binary;
}

if (process.platform === "darwin") {
  console.error("End-to-end tests run on Windows and Linux only (no WebDriver for WKWebView).");
  process.exit(1);
}

const args = process.argv.slice(2);
const skipBuild = args.includes("--no-build");
const targetDir = resolve("target/e2e");
/** @type {NodeJS.ProcessEnv} */
const env = { ...process.env, CARGO_TARGET_DIR: targetDir };
if (!skipBuild) {
  // Debug, but with the frontend built in (a plain debug build loads it from the dev server).
  run("pnpm", ["tauri", "build", "--debug", "--no-bundle"], { env });
}

env.NOBLAME_E2E_APP = join(targetDir, "debug", exe("noblame"));
env.NOBLAME_E2E_TAURI_DRIVER = tauriDriver();
if (isWindows) env.NOBLAME_E2E_NATIVE_DRIVER = edgeDriver();
run(
  "pnpm",
  [
    "exec",
    "vitest",
    "run",
    "--config",
    "e2e/vitest.config.ts",
    ...args.filter((a) => a !== "--no-build"),
  ],
  { env },
);

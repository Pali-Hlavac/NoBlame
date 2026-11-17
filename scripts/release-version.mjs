// The version lives in three files (Cargo.toml's workspace, package.json, tauri.conf.json) and
// in CHANGELOG.md's headings. `pnpm release:version 0.2.0` sets it everywhere and turns
// `## [Unreleased]` into `## [0.2.0] - <today>` under a new, empty Unreleased section.
// `node scripts/release-version.mjs --check 0.2.0` (the release workflow, from the tag) fails
// unless all of them say that version.
import { readFileSync, writeFileSync } from "node:fs";

const SEMVER = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;
const FILES = {
  cargo: "Cargo.toml",
  npm: "package.json",
  tauri: "src-tauri/tauri.conf.json",
  changelog: "CHANGELOG.md",
};
const CARGO_VERSION = /(\[workspace\.package\][^[]*?\nversion = ")([^"]+)(")/;

/** @param {string} path */
const read = (path) => readFileSync(path, "utf8");

function versions() {
  return {
    cargo: CARGO_VERSION.exec(read(FILES.cargo))?.[2],
    npm: JSON.parse(read(FILES.npm)).version,
    tauri: JSON.parse(read(FILES.tauri)).version,
  };
}

/** @param {string} version */
function check(version) {
  const found = versions();
  const wrong = Object.entries(found).filter(([, value]) => value !== version);
  const released = read(FILES.changelog).includes(`## [${version}] - `);
  for (const [file, value] of wrong) {
    console.error(
      `${FILES[/** @type {keyof typeof FILES} */ (file)]} says ${String(value)}, not ${version}.`,
    );
  }
  if (!released) console.error(`CHANGELOG.md has no "## [${version}] - <date>" section.`);
  if (wrong.length > 0 || !released) process.exit(1);
  console.log(`Version ${version} everywhere.`);
}

/** @param {string} version */
function set(version) {
  const cargo = read(FILES.cargo);
  if (!CARGO_VERSION.test(cargo)) throw new Error("No version in [workspace.package]");
  writeFileSync(FILES.cargo, cargo.replace(CARGO_VERSION, `$1${version}$3`));
  for (const file of [FILES.npm, FILES.tauri]) {
    writeFileSync(file, read(file).replace(/("version": ")[^"]+(")/, `$1${version}$2`));
  }
  const changelog = read(FILES.changelog);
  const today = new Date().toISOString().slice(0, 10);
  if (!changelog.includes("## [Unreleased]")) throw new Error("CHANGELOG.md has no Unreleased");
  writeFileSync(
    FILES.changelog,
    changelog.replace("## [Unreleased]", `## [Unreleased]\n\n## [${version}] - ${today}`),
  );
  console.log(
    `Set ${version}. Run \`cargo check\` to update Cargo.lock, then commit and tag v${version}.`,
  );
}

const [first, second] = process.argv.slice(2);
const checking = first === "--check";
const version = (checking ? second : first)?.replace(/^v/, "");
if (!version || !SEMVER.test(version)) {
  console.error("Usage: release-version.mjs [--check] <version, e.g. 0.2.0>");
  process.exit(2);
}
if (checking) check(version);
else set(version);

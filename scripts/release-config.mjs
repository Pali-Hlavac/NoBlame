// Writes src-tauri/tauri.release.json, the release workflow's additions to tauri.conf.json, from
// what the repository's secrets provide (ADR 0017, docs/development/release.md):
//
// - TAURI_SIGNING_PRIVATE_KEY: updater artifacts (signed `.sig` files and `latest.json`);
// - WINDOWS_CERTIFICATE_THUMBPRINT (set by the workflow after importing the certificate):
//   Authenticode signing of the Windows installers and executable.
//
// Without them the installers are built unsigned and without updates; nothing pretends.
// macOS signing and notarization need no file: the bundler reads APPLE_* from the environment.
import { writeFileSync } from "node:fs";

const TIMESTAMP_URL = "http://timestamp.digicert.com";
const config = { bundle: /** @type {Record<string, unknown>} */ ({}) };

if (process.env.TAURI_SIGNING_PRIVATE_KEY) {
  config.bundle.createUpdaterArtifacts = true;
} else {
  console.log("No TAURI_SIGNING_PRIVATE_KEY: built without updater artifacts.");
}

const thumbprint = process.env.WINDOWS_CERTIFICATE_THUMBPRINT;
if (thumbprint) {
  config.bundle.windows = {
    certificateThumbprint: thumbprint,
    digestAlgorithm: "sha256",
    timestampUrl: TIMESTAMP_URL,
  };
} else if (process.platform === "win32") {
  console.log("No Windows certificate: the installers are not signed.");
}

writeFileSync("src-tauri/tauri.release.json", `${JSON.stringify(config, null, 2)}\n`);
console.log("Wrote src-tauri/tauri.release.json:", JSON.stringify(config));

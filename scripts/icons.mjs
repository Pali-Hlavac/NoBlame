// `pnpm icons`: the app's icons from the owner's pictures in `assets/logo/`, one folder per
// system. Runs `tauri icon` on `linux/cream.png` (the PNGs of the bundles and of Linux), then
// puts the hand-made Windows `.ico` and macOS `.icns` files over the ones it generated.
//
// Three variants (Settings → Appearance): cream (the installed program's), vibrant, and free
// (no background; Windows and Linux only). The app loads them at run time from
// `src-tauri/icons/`: `{icon,vibrant,free}.ico` on Windows, `{icon,vibrant}.icns` on macOS,
// `128x128@2x.png` and `linux-{vibrant,free}.png` on Linux. Settings shows
// `public/icon-*.png`. A Rust test (`windows/icon/mod.rs`) fails if the `.ico` and `.icns`
// files in `src-tauri/icons/` are not byte for byte the hand-made ones.
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const LOGO = "assets/logo";
const ICONS = "src-tauri/icons";
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
/** The `.icns` entry holding the 256 px picture, shown in Settings on macOS. */
const ICNS_256 = "ic08";

/** @param {string[]} args */
function tauriIcon(args) {
  execFileSync("pnpm", ["exec", "tauri", "icon", ...args], { stdio: "inherit", shell: true });
}

/**
 * The biggest PNG picture inside an `.ico` file.
 * @param {string} icoPath
 */
function biggestIcoPng(icoPath) {
  const ico = readFileSync(icoPath);
  const count = ico.readUInt16LE(4);
  let best = null;
  for (let index = 0; index < count; index += 1) {
    const entry = 6 + index * 16;
    const size = ico[entry] === 0 ? 256 : ico[entry];
    const length = ico.readUInt32LE(entry + 8);
    const offset = ico.readUInt32LE(entry + 12);
    const data = ico.subarray(offset, offset + length);
    const isPng = data.subarray(0, 4).equals(PNG_SIGNATURE);
    if (isPng && (best === null || size > best.size)) best = { size, data };
  }
  if (best === null) throw new Error(`${icoPath} has no PNG picture`);
  return best.data;
}

/**
 * One entry of an `.icns` file, which must be a PNG.
 * @param {string} icnsPath
 * @param {string} type
 */
function icnsPng(icnsPath, type) {
  const icns = readFileSync(icnsPath);
  for (let offset = 8; offset < icns.length;) {
    const length = icns.readUInt32BE(offset + 4);
    const data = icns.subarray(offset + 8, offset + length);
    if (icns.toString("latin1", offset, offset + 4) === type) {
      if (!data.subarray(0, 4).equals(PNG_SIGNATURE)) break;
      return data;
    }
    offset += length;
  }
  throw new Error(`${icnsPath} has no PNG ${type} entry`);
}

// Everything tauri makes, from the cream picture.
tauriIcon([`${LOGO}/linux/cream.png`]);

// The other Linux variants at 256 px, resized by the same tool.
for (const variant of ["vibrant", "free"]) {
  const out = mkdtempSync(join(tmpdir(), "noblame-icon-"));
  try {
    tauriIcon([`${LOGO}/linux/${variant}.png`, "-o", out, "-p", "256"]);
    copyFileSync(join(out, "256x256.png"), `${ICONS}/linux-${variant}.png`);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

// The hand-made ones over the generated ones.
copyFileSync(`${LOGO}/windows/cream.ico`, `${ICONS}/icon.ico`);
copyFileSync(`${LOGO}/windows/vibrant.ico`, `${ICONS}/vibrant.ico`);
copyFileSync(`${LOGO}/windows/free.ico`, `${ICONS}/free.ico`);
copyFileSync(`${LOGO}/mac/cream.icns`, `${ICONS}/icon.icns`);
copyFileSync(`${LOGO}/mac/vibrant.icns`, `${ICONS}/vibrant.icns`);

// Previews in Settings: the Windows pictures (also right for Linux), and the macOS ones.
copyFileSync(`${ICONS}/128x128@2x.png`, "public/icon.png");
writeFileSync("public/icon-vibrant.png", biggestIcoPng(`${LOGO}/windows/vibrant.ico`));
writeFileSync("public/icon-free.png", biggestIcoPng(`${LOGO}/windows/free.ico`));
writeFileSync("public/icon-mac-cream.png", icnsPng(`${LOGO}/mac/cream.icns`, ICNS_256));
writeFileSync("public/icon-mac-vibrant.png", icnsPng(`${LOGO}/mac/vibrant.icns`, ICNS_256));
console.log("Icons made from assets/logo/{linux,windows,mac}/.");

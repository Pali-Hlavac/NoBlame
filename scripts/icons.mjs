// Second step of `pnpm icons`, after `tauri icon assets/logo/noblame.png`: uses the hand-made
// Windows icons instead of the generated one, and copies 256 px icons for the UI.
//
// The app has two icons (Settings → Appearance): golden (`noblame.*`, the installed program's)
// and vibrant (`noblame_vibrant.*`). The windows load either at run time from
// `src-tauri/icons/{icon,vibrant}.ico`; the Settings tab shows `public/icon{,-vibrant}.png`.
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";

/**
 * The biggest PNG picture inside an `.ico` file.
 * @param {string} icoPath
 */
function biggestPng(icoPath) {
  const ico = readFileSync(icoPath);
  const count = ico.readUInt16LE(4);
  let best = null;
  for (let index = 0; index < count; index += 1) {
    const entry = 6 + index * 16;
    const size = ico[entry] === 0 ? 256 : ico[entry];
    const length = ico.readUInt32LE(entry + 8);
    const offset = ico.readUInt32LE(entry + 12);
    const data = ico.subarray(offset, offset + length);
    const isPng = data.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    if (isPng && (best === null || size > best.size)) best = { size, data };
  }
  if (best === null) throw new Error(`${icoPath} has no PNG picture`);
  return best.data;
}

copyFileSync("assets/logo/noblame.ico", "src-tauri/icons/icon.ico");
copyFileSync("assets/logo/noblame_vibrant.ico", "src-tauri/icons/vibrant.ico");
copyFileSync("src-tauri/icons/128x128@2x.png", "public/icon.png");
writeFileSync("public/icon-vibrant.png", biggestPng("assets/logo/noblame_vibrant.ico"));
console.log("Copied the hand-made .ico files to src-tauri/icons/ and the 256 px icons to public/.");

// Second step of `pnpm icons`, after `tauri icon assets/logo/noblame.png`: uses the hand-made
// Windows icon instead of the generated one, and copies a 256 px icon for the UI.
import { copyFileSync } from "node:fs";

copyFileSync("assets/logo/noblame.ico", "src-tauri/icons/icon.ico");
copyFileSync("src-tauri/icons/128x128@2x.png", "public/icon.png");
console.log(
  "Copied noblame.ico to src-tauri/icons/icon.ico and the 256 px icon to public/icon.png.",
);

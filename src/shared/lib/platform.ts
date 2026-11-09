/** Platform detection for keyboard shortcut handling and labels. */

const MAC_PLATFORM_PATTERN = /mac|iphone|ipad/i;

/** True when running on macOS (Cmd is the primary modifier). */
export function isMacPlatform(): boolean {
  return MAC_PLATFORM_PATTERN.test(navigator.userAgent);
}

const WINDOWS_PLATFORM_PATTERN = /windows/i;

/** True when running on Windows. */
export function isWindowsPlatform(): boolean {
  return WINDOWS_PLATFORM_PATTERN.test(navigator.userAgent);
}

/** What the file manager is called here: "Explorer", "Finder" or "the file manager". */
export function fileManagerName(): string {
  if (isWindowsPlatform()) return "Explorer";
  return isMacPlatform() ? "Finder" : "the file manager";
}

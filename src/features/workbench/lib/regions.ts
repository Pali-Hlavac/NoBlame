/**
 * Focus regions of the main window (activity bar, module dock, toolbar, tabs, status bar),
 * marked with `data-workbench-region`. F6 moves between them, as in VS Code and Visual Studio.
 */

const REGION_SELECTOR = "[data-workbench-region]";
const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/** Focuses the first focusable element of the region `offset` steps away from the current one. */
export function focusRegion(offset: number, root: ParentNode = document): void {
  // Hidden regions (the collapsed sidebar) are `inert`.
  const regions = Array.from(root.querySelectorAll<HTMLElement>(REGION_SELECTOR)).filter(
    (region) => !region.closest("[inert]"),
  );
  if (regions.length === 0) return;
  const current = regions.findIndex((region) => region.contains(document.activeElement));
  const start = current === -1 ? (offset > 0 ? -1 : 0) : current;
  for (let step = 1; step <= regions.length; step++) {
    const index = (((start + offset * step) % regions.length) + regions.length) % regions.length;
    const target = regions[index]?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    if (target) {
      target.focus();
      return;
    }
  }
}

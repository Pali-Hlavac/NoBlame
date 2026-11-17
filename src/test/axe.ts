/**
 * Accessibility checks in component tests with axe-core: names, roles and ARIA states, labels,
 * nesting of interactive elements, duplicate ids. Colour contrast cannot be measured in jsdom
 * (no layout); `src/app/contrast.test.ts` checks the theme's colours instead.
 */
import axe from "axe-core";

/** Rules that need a real page or a whole window, not one component. */
const OFF_IN_COMPONENT_TESTS = {
  "color-contrast": { enabled: false },
  // A component is rendered on its own: no landmarks, page title or main heading around it.
  region: { enabled: false },
  "landmark-one-main": { enabled: false },
  "page-has-heading-one": { enabled: false },
  "document-title": { enabled: false },
  "html-has-lang": { enabled: false },
} as const;

const CONTROLS = "button, a[href], input, select, textarea, [tabindex]";

/**
 * Whether the controls inside `element` are all for the mouse only: out of the tab order and
 * hidden from assistive technology, with the keyboard doing the same through the element
 * itself (a list row's buttons: Space stages, the row's name says what is chosen). axe counts
 * any focusable control as nested; these do not take focus when clicked either.
 */
function onlyMouseControls(element: Element): boolean {
  return [...element.querySelectorAll(CONTROLS)].every(
    (control) =>
      control.getAttribute("tabindex") === "-1" && control.closest('[aria-hidden="true"]') !== null,
  );
}

/** Markup of libraries the app does not write: dockview's tab holds its close button. */
const THIRD_PARTY = ".dv-tab";

function excused(rule: string, target: readonly unknown[]): boolean {
  const selector = target[0];
  const element = typeof selector === "string" ? document.querySelector(selector) : null;
  if (!element || rule !== "nested-interactive") return false;
  return element.matches(THIRD_PARTY) || onlyMouseControls(element);
}

/** The problems axe finds in `container`, one line each (empty when there are none). */
export async function accessibilityProblems(container: Element = document.body): Promise<string[]> {
  const results = await axe.run(container, { rules: OFF_IN_COMPONENT_TESTS });
  return results.violations.flatMap((violation) =>
    violation.nodes
      .filter((node) => !excused(violation.id, node.target))
      .map((node) => `${violation.id}: ${violation.help} — ${node.html.slice(0, 160)}`),
  );
}

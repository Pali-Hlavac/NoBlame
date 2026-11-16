/**
 * Searching the Settings tab: what the user sees is filtered, so every setting is found by its
 * label, description, options or current value without listing them twice. Sections are
 * `section[data-settings-section]`; their settings are the elements after the heading. A setting
 * that is a list (keyboard shortcuts, git settings) marks its rows `data-setting-item` and is
 * filtered row by row.
 */

const SECTION = "section[data-settings-section]";
const ITEM = "[data-setting-item]";

/** Lower case, without accents, so "zmeny" finds "Změny" and "commit" finds "Commit". */
export function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** Every word of the query is somewhere in the text. */
function matches(element: Element, words: readonly string[]): boolean {
  const text = normalize(element.textContent);
  return words.every((word) => text.includes(word));
}

function show(element: Element, shown: boolean): void {
  if (element instanceof HTMLElement) element.hidden = !shown;
}

/** Shows or hides the rows of a list setting; true when one is shown. */
function filterRows(container: Element, words: readonly string[]): boolean {
  let any = false;
  for (const row of container.querySelectorAll(ITEM)) {
    const shown = matches(row, words);
    show(row, shown);
    any ||= shown;
  }
  return any;
}

/**
 * Hides the settings under `root` that do not match `query`, and the sections left empty.
 * An empty query shows everything. Returns how many sections are shown.
 */
export function filterSettings(root: Element, query: string): number {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  let sections = 0;
  for (const section of root.querySelectorAll(SECTION)) {
    const [heading, ...settings] = [...section.children];
    const whole = words.length === 0 || (heading !== undefined && matches(heading, words));
    let any = whole;
    for (const setting of settings) {
      // A list's rows are filtered every time, so none stays hidden from an earlier query.
      const shown = setting.querySelector(ITEM)
        ? filterRows(setting, whole ? [] : words) || whole
        : whole || matches(setting, words);
      show(setting, shown);
      any ||= shown;
    }
    show(section, any);
    if (any) sections += 1;
  }
  return sections;
}

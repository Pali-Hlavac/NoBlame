import { filterSettings, normalize } from "./filter";

function settingsPage(): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = `
    <section data-settings-section><h2>Commit graph</h2>
      <div id="highlight">Highlight the selected commit</div>
      <div id="body">Show the rest of the message</div>
    </section>
    <section data-settings-section><h2>Keyboard shortcuts</h2>
      <p id="intro">Click a shortcut</p>
      <div id="group"><h3>History</h3><ul>
        <li data-setting-item id="find">Find commits Ctrl+F</li>
        <li data-setting-item id="goto">Go to commit Ctrl+G</li>
      </ul></div>
    </section>`;
  return root;
}

const shown = (root: HTMLElement, id: string) => !root.querySelector<HTMLElement>(`#${id}`)?.hidden;

describe("filterSettings", () => {
  it("keeps the matching settings and the sections holding them", () => {
    const root = settingsPage();
    expect(filterSettings(root, "message")).toBe(1);
    expect(shown(root, "body")).toBe(true);
    expect(shown(root, "highlight")).toBe(false);
    expect(root.querySelectorAll("section")[1]?.hidden).toBe(true);
  });

  it("filters a list row by row, and shows a whole section named by the query", () => {
    const root = settingsPage();
    filterSettings(root, "go commit");
    expect([shown(root, "goto"), shown(root, "find"), shown(root, "intro")]).toEqual([
      true,
      false,
      false,
    ]);
    filterSettings(root, "keyboard");
    expect([shown(root, "goto"), shown(root, "find"), shown(root, "intro")]).toEqual([
      true,
      true,
      true,
    ]);
  });

  it("shows everything again for an empty query, and ignores case and accents", () => {
    const root = settingsPage();
    expect(filterSettings(root, "nothing like it")).toBe(0);
    expect(filterSettings(root, "")).toBe(2);
    expect(shown(root, "find")).toBe(true);
    expect(normalize("Změny")).toBe("zmeny");
  });
});

import html from "../../../index.html?raw";
import { BIRD, NOTES, noteTransform, startScreenHtml } from "./loadingBird";

describe("the loading bird", () => {
  it("places the notes next to the beak", () => {
    const [first] = NOTES;
    expect(first && noteTransform(first)).toBe(
      `translate(${BIRD.beak.x + 3 * BIRD.noteScale} ${BIRD.beak.y - 7 * BIRD.noteScale}) scale(${BIRD.noteScale})`,
    );
  });

  it("draws the start screen inline, with the bird, its notes and a label", () => {
    const markup = startScreenHtml();
    expect(markup).toContain(BIRD.d);
    for (const note of NOTES) expect(markup).toContain(note.d);
    expect(markup).toContain("Starting…");
    expect(markup).not.toContain("url(");
  });

  it("lets the start screen move the window", () => {
    expect(startScreenHtml()).toContain('data-tauri-drag-region="deep"');
  });

  it("has a place for the start screen in index.html", () => {
    expect(html).toContain("<!-- start-screen -->");
  });
});

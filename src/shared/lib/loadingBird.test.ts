import html from "../../../index.html?raw";
import { LOADING_BIRD, NOTES, noteTransform, startScreenHtml } from "./loadingBird";

describe("the loading bird", () => {
  it("places the notes next to the beak", () => {
    const [first] = NOTES;
    expect(first && noteTransform(first)).toBe(
      `translate(${LOADING_BIRD.beak.x + 3} ${LOADING_BIRD.beak.y - 7}) scale(1)`,
    );
  });

  it("builds the start screen from the picture and the notes", () => {
    const markup = startScreenHtml();
    expect(markup).toContain(`url(${LOADING_BIRD.image})`);
    expect(markup).toContain("Starting…");
    for (const note of NOTES) expect(markup).toContain(note.d);
  });

  it("has a place for the start screen in index.html", () => {
    expect(html).toContain("<!-- start-screen -->");
  });
});

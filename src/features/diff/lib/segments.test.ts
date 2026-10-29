import { segments } from "./segments";

describe("segments", () => {
  it("cuts the text at the changed ranges", () => {
    expect(segments("let a = 1;", [[8, 9]])).toEqual([
      { text: "let a = ", changed: false },
      { text: "1", changed: true },
      { text: ";", changed: false },
    ]);
  });

  it("keeps the whole line when nothing changed", () => {
    expect(segments("same", [])).toEqual([{ text: "same", changed: false }]);
    expect(segments("", [])).toEqual([{ text: "", changed: false }]);
  });

  it("clips ranges that run past the end", () => {
    expect(
      segments("abc", [
        [1, 10],
        [20, 30],
      ]),
    ).toEqual([
      { text: "a", changed: false },
      { text: "bc", changed: true },
    ]);
  });
});

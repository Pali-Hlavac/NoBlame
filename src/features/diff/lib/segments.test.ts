import { segments } from "./segments";

const plain = (text: string) => ({ text, changed: false, syntax: undefined });

describe("segments", () => {
  it("cuts the text at the changed ranges", () => {
    expect(segments("let a = 1;", [[8, 9]])).toEqual([
      plain("let a = "),
      { text: "1", changed: true, syntax: undefined },
      plain(";"),
    ]);
  });

  it("keeps the whole line when nothing is marked", () => {
    expect(segments("same", [])).toEqual([plain("same")]);
    expect(segments("", [])).toEqual([plain("")]);
  });

  it("clips ranges that run past the end", () => {
    expect(
      segments("abc", [
        [1, 10],
        [20, 30],
      ]),
    ).toEqual([plain("a"), { text: "bc", changed: true, syntax: undefined }]);
  });

  it("combines syntax colours with changed words", () => {
    expect(segments('x = "ab"', [[5, 7]], [[4, 8, "string"]])).toEqual([
      plain("x = "),
      { text: '"', changed: false, syntax: "string" },
      { text: "ab", changed: true, syntax: "string" },
      { text: '"', changed: false, syntax: "string" },
    ]);
  });
});

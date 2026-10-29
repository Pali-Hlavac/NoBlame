import type { ChangedFileDto } from "@/shared/ipc/bindings";

import {
  diffTabTitle,
  formatBytes,
  formatChangeCounts,
  gutterDigits,
  unchangedText,
} from "./format";

describe("formatBytes", () => {
  it("names bytes, then binary units", () => {
    expect(formatBytes(0)).toBe("0 bytes");
    expect(formatBytes(1)).toBe("1 byte");
    expect(formatBytes(1023)).toBe("1,023 bytes");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(64 * 1024 * 1024)).toBe("64 MB");
    expect(formatBytes(3 * 1024 ** 3)).toBe("3 GB");
  });
});

describe("formatChangeCounts", () => {
  it("shows additions and deletions", () => {
    expect(formatChangeCounts(1200, 3)).toBe("+1,200 −3");
  });
});

describe("diffTabTitle", () => {
  it("names the file without its folder", () => {
    expect(diffTabTitle("src/app/main.rs")).toBe("Diff: main.rs");
    expect(diffTabTitle("README.md")).toBe("Diff: README.md");
    expect(diffTabTitle(undefined)).toBe("Diff");
  });
});

describe("gutterDigits", () => {
  it("fits the largest line number", () => {
    expect(gutterDigits(5, 9)).toBe(3);
    expect(gutterDigits(12_345, 99)).toBe(5);
  });
});

describe("unchangedText", () => {
  const file = (change: Partial<ChangedFileDto>): ChangedFileDto => ({
    path: "a.txt",
    previousPath: null,
    status: "modified",
    oldId: "1",
    newId: "2",
    submodule: false,
    ...change,
  });

  it("explains each reason a changed file has no rows", () => {
    expect(unchangedText(file({ newId: "1" }), "show")).toMatch(/mode changed/);
    expect(unchangedText(file({ newId: "1", previousPath: "b.txt" }), "show")).toMatch(/moved/);
    expect(unchangedText(file({}), "ignoreAll")).toMatch(/Only whitespace changed/);
    expect(unchangedText(file({ status: "added", oldId: null }), "show")).toMatch(
      /new file is empty/,
    );
  });
});

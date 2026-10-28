import type { ChangedFileDto } from "@/shared/ipc/bindings";

import { describeFile, splitPath } from "./files";

const file = (overrides: Partial<ChangedFileDto>): ChangedFileDto => ({
  path: "src/app/main.ts",
  previousPath: null,
  status: "modified",
  oldId: "a",
  newId: "b",
  submodule: false,
  ...overrides,
});

describe("changed file helpers", () => {
  it("splits a path into name and folder", () => {
    expect(splitPath("src/app/main.ts")).toEqual({ name: "main.ts", folder: "src/app" });
    expect(splitPath("README.md")).toEqual({ name: "README.md", folder: "" });
  });

  it("describes a row for screen readers", () => {
    expect(describeFile(file({}))).toBe("main.ts, modified, in src/app");
    expect(describeFile(file({ status: "renamed", previousPath: "old.ts", path: "new.ts" }))).toBe(
      "new.ts, renamed, from old.ts",
    );
  });
});

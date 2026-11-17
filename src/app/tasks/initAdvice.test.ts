import type { FolderStateDto } from "@/shared/ipc/bindings";

import { initAdvice } from "./initAdvice";

function state(patch: Partial<FolderStateDto>): FolderStateDto {
  return { kind: "empty", repository: null, isRepository: false, ...patch };
}

describe("what the Create repository window says about a folder", () => {
  it("refuses a file and a repository, nothing to say about an empty folder", () => {
    expect(initAdvice(state({ kind: "file" }))).toMatchObject({ blocked: true, tone: "error" });
    expect(
      initAdvice(state({ kind: "filled", repository: "/work/app", isRepository: true })),
    ).toMatchObject({ blocked: true, text: "This folder is a repository already." });
    expect(initAdvice(state({}))).toBeNull();
  });

  it("warns about a repository inside another, and explains new and filled folders", () => {
    const nested = initAdvice(state({ kind: "missing", repository: "/work/app" }));
    expect(nested).toMatchObject({ blocked: false, tone: "warning" });
    expect(nested?.text).toMatch(/inside the repository \/work\/app.*submodule/);
    expect(initAdvice(state({ kind: "missing" }))?.text).toMatch(/will be created/);
    expect(initAdvice(state({ kind: "filled" }))?.text).toMatch(/They stay/);
  });
});

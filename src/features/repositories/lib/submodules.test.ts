import type { SubmoduleDto } from "@/shared/ipc/bindings";

import { repositoryTab } from "./path";
import { submoduleTabIds } from "./submodules";

const submodule = (workDir: string, children: SubmoduleDto[] = []): SubmoduleDto => ({
  name: workDir,
  path: workDir,
  workDir,
  url: null,
  initialized: true,
  recorded: null,
  checkedOut: null,
  children,
});

describe("submoduleTabIds", () => {
  it("collects the tab ids of nested submodules at every depth", () => {
    const ids = submoduleTabIds([
      [submodule("/app/libs/middle", [submodule("/app/libs/middle/leaf")])],
      [],
    ]);
    expect(ids).toEqual(
      new Set([repositoryTab("/app/libs/middle").id, repositoryTab("/app/libs/middle/leaf").id]),
    );
  });
});

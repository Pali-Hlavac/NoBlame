import type { TreeEntryDto, TreeListingDto } from "@/shared/ipc/bindings";

import { buildRows, describeRow, foldersToLoad, parentPath, parentRow } from "./rows";

const folder = (name: string, id: string): TreeEntryDto => ({ name, kind: "folder", id });
const file = (name: string): TreeEntryDto => ({ name, kind: "file", id: `blob-${name}` });
const listing = (entries: TreeEntryDto[], total = entries.length): TreeListingDto => ({
  entries,
  total,
});

const LISTINGS: Record<string, TreeListingDto> = {
  root: listing([folder("src", "t-src"), folder("docs", "t-docs"), file("README.md")]),
  "t-src": listing([folder("app", "t-app"), file("main.rs")]),
  "t-app": listing([file("view.rs")], 3),
};

describe("foldersToLoad", () => {
  it("lists the root and the open folders below open, loaded folders", () => {
    const expanded = { src: true, "src/app": true, docs: true, "docs/old": true } as const;
    const ids = foldersToLoad("root", expanded, (id) => LISTINGS[id]);
    // docs is open but not loaded yet, so its open subfolder is not known.
    expect(ids).toEqual(["root", "t-src", "t-app", "t-docs"]);
  });
});

describe("buildRows", () => {
  it("puts the entries of open folders below them, with notes for the rest", () => {
    const expanded = { src: true, "src/app": true, docs: true } as const;
    const rows = buildRows("root", expanded, (id) =>
      id === "t-docs" ? { error: new Error("gone") } : { data: LISTINGS[id] },
    );
    expect(rows.map((row) => [row.path, row.depth, row.type])).toEqual([
      ["src", 0, "entry"],
      ["src/app", 1, "entry"],
      ["src/app/view.rs", 2, "entry"],
      ["src/app\0more", 2, "note"],
      ["src/main.rs", 1, "entry"],
      ["docs", 0, "entry"],
      ["docs\0error", 1, "note"],
      ["README.md", 0, "entry"],
    ]);
    expect(rows[3]).toMatchObject({ text: "2 more not shown" });
    expect(rows[0]).toMatchObject({ expanded: true });
  });

  it("shows a loading note for a folder not read yet", () => {
    const rows = buildRows("root", {}, () => undefined);
    expect(rows).toEqual([{ type: "note", path: "\0loading", depth: 0, text: "Loading…" }]);
  });
});

describe("navigation helpers", () => {
  it("finds the parent folder and its row", () => {
    expect(parentPath("src/app/view.rs")).toBe("src/app");
    expect(parentPath("README.md")).toBe("");
    const rows = buildRows("root", { src: true }, (id) => ({ data: LISTINGS[id] }));
    expect(parentRow(rows, 2)).toBe(0);
    expect(parentRow(rows, 0)).toBeUndefined();
  });

  it("describes rows for screen readers", () => {
    const rows = buildRows("root", { src: true }, (id) => ({ data: LISTINGS[id] }));
    expect(rows.map(describeRow).slice(0, 2)).toEqual(["src, folder, open", "app, folder"]);
  });
});

import type { RefEntry } from "@/shared/ipc/bindings";

import { buildRows, type BranchRow } from "./rows";

const ref = (name: string, kind: RefEntry["label"]["kind"]): RefEntry => ({
  label: { name, kind, isHead: false },
  target: "0".repeat(40),
  row: 0,
});

const ENTRIES = [
  ref("main", "branch"),
  ref("topic/a", "branch"),
  ref("upstream/main", "remote"),
  ref("origin/main", "remote"),
  ref("origin/topic/a", "remote"),
  ref("v1.0", "tag"),
];

const describeRows = (rows: BranchRow[]) =>
  rows.map((row) => (row.type === "section" ? `# ${row.title} (${row.count})` : row.display));

describe("buildRows", () => {
  it("groups local branches, each remote and tags", () => {
    expect(describeRows(buildRows(ENTRIES, "", new Set()))).toEqual([
      "# Local branches (2)",
      "main",
      "topic/a",
      "# Remote: origin (2)",
      "main",
      "topic/a",
      "# Remote: upstream (1)",
      "main",
      "# Tags (1)",
      "v1.0",
    ]);
  });

  it("filters by full name and hides empty sections", () => {
    expect(describeRows(buildRows(ENTRIES, "TOPIC", new Set()))).toEqual([
      "# Local branches (1)",
      "topic/a",
      "# Remote: origin (1)",
      "topic/a",
    ]);
  });

  it("shows only the header of collapsed sections", () => {
    const rows = describeRows(buildRows(ENTRIES, "", new Set(["local", "tags"])));
    expect(rows[0]).toBe("# Local branches (2)");
    expect(rows[1]).toBe("# Remote: origin (2)");
    expect(rows.at(-1)).toBe("# Tags (1)");
  });
});

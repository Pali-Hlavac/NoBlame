import { describe, expect, it } from "vitest";

import type { RefEntry, RefKindDto, TipsDto } from "@/shared/ipc/bindings";

import { headNameOf, isChosen, pickerSections, tipsLabel } from "./filter";

function ref(kind: RefKindDto, name: string, isHead = false): RefEntry {
  return { label: { kind, name, isHead }, target: "0".repeat(40), row: 0 };
}

const REFS = [
  ref("branch", "main", true),
  ref("branch", "feature/login"),
  ref("remote", "origin/main"),
  ref("tag", "v1.0"),
];

describe("tipsLabel", () => {
  it("names what the tab shows", () => {
    expect(tipsLabel({ type: "all" }, "main")).toBe("All branches");
    expect(tipsLabel({ type: "head" }, "main")).toBe("Current branch (main)");
    expect(tipsLabel({ type: "head" }, undefined)).toBe("Current branch");
    expect(tipsLabel({ type: "refs", refs: [{ kind: "tag", name: "v1.0" }] }, "main")).toBe("v1.0");
  });
});

describe("headNameOf", () => {
  it("finds the branch HEAD is on, or says HEAD when detached", () => {
    expect(headNameOf(REFS)).toBe("main");
    expect(headNameOf([ref("branch", "main")])).toBe("HEAD");
    expect(headNameOf(undefined)).toBeUndefined();
  });
});

describe("pickerSections", () => {
  it("groups matches by kind, ignoring case", () => {
    const { sections, hidden } = pickerSections(REFS, "MAIN");
    expect(sections.map((section) => [section.title, section.refs.length])).toEqual([
      ["Branches", 1],
      ["Remote branches", 1],
    ]);
    expect(hidden).toBe(0);
  });

  it("lists at most the limit and counts the rest", () => {
    const { sections, hidden } = pickerSections(REFS, "", 3);
    expect(sections.flatMap((section) => section.refs).length).toBe(3);
    expect(hidden).toBe(1);
  });
});

describe("isChosen", () => {
  it("matches kind and name", () => {
    const tips: TipsDto = { type: "refs", refs: [{ kind: "branch", name: "main" }] };
    expect(isChosen(tips, ref("branch", "main").label)).toBe(true);
    expect(isChosen(tips, ref("remote", "main").label)).toBe(false);
    expect(isChosen({ type: "all" }, ref("branch", "main").label)).toBe(false);
  });
});

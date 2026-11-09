import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS, withDefaults } from "./defaults";
import { WHOLE_FILE_CONTEXT } from "./diff";

describe("withDefaults", () => {
  it("returns the defaults before settings are loaded", () => {
    expect(withDefaults(undefined)).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps saved values and fills the missing ones", () => {
    const settings = withDefaults({ theme: "dark", repositories: { showActionsMenu: false } });
    expect(settings.theme).toBe("dark");
    expect(settings.repositories.showActionsMenu).toBe(false);
    expect(settings.graph.highlightSelection).toBe(true);
  });

  it("fills a partly saved external diff tool", () => {
    const settings = withDefaults({ diff: { externalTool: { kind: "custom" } } });
    expect(settings.diff.externalTool).toEqual({ kind: "custom", command: "" });
    expect(withDefaults({ diff: {} }).diff.externalTool.kind).toBe("git");
    expect(withDefaults({ diff: {} }).diff.mergeTool).toEqual({ kind: "git", name: "" });
  });

  it("turns the old whole-file context into the whole-file switch", () => {
    const settings = withDefaults({ diff: { contextLines: WHOLE_FILE_CONTEXT } });
    expect(settings.diff).toMatchObject({ contextLines: 3, wholeFile: true });
  });
});

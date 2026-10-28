import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS, withDefaults } from "./defaults";

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
});

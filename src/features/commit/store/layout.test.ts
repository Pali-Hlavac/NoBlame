import { changeCommitLayout, readCommitLayout } from "./layout";

describe("the Commit module's layout", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("is saved and read back", () => {
    changeCommitLayout({ lists: { changes: 70, staged: 30 }, folded: true });
    expect(readCommitLayout()).toEqual({
      lists: { changes: 70, staged: 30 },
      beside: null,
      folded: true,
    });
  });

  it("falls back to the default for anything unreadable", () => {
    localStorage.setItem("noblame.commit-layout", '{"lists": {"changes": "wide"}, "folded": 1');
    expect(readCommitLayout()).toEqual({ lists: null, beside: null, folded: false });
    localStorage.setItem("noblame.commit-layout", '{"lists": {"changes": "wide"}, "folded": 1}');
    expect(readCommitLayout()).toEqual({ lists: null, beside: null, folded: false });
  });
});

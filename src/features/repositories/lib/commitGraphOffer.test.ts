import { commitGraphOffer, describeDuration } from "./commitGraphOffer";

describe("commitGraphOffer", () => {
  it("stays plain while the graph loads fast or has not loaded", () => {
    expect(commitGraphOffer(undefined).prominent).toBe(false);
    expect(commitGraphOffer({ rows: 10_000, buildMs: 150 }).prominent).toBe(false);
  });

  it("names the cost after a slow load", () => {
    const offer = commitGraphOffer({ rows: 1_503_174, buildMs: 10_900 });
    expect(offer.prominent).toBe(true);
    expect(offer.message).toContain("Reading 1,503,174 commits took 10.9 s.");
    expect(offer.message).toContain("Writing one takes about 11 seconds, once");
  });

  it("rounds durations to words", () => {
    expect(describeDuration(2)).toBe("a few seconds");
    expect(describeDuration(42.4)).toBe("about 42 seconds");
    expect(describeDuration(300)).toBe("about 5 minutes");
  });
});

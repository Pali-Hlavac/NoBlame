import { fnv1a, initials, personHue } from "./person";

describe("initials badges", () => {
  it("takes the first and last word's initials", () => {
    expect(initials("Ada Lovelace")).toBe("AL");
    expect(initials("  linus ")).toBe("L");
    expect(initials("Jean-Luc Picard")).toBe("JP");
    expect(initials("Ada King Lovelace")).toBe("AL");
    expect(initials("élise durand")).toBe("ÉD");
    expect(initials("")).toBe("?");
  });

  it("hashes like 32-bit FNV-1a", () => {
    // Published test vectors.
    expect(fnv1a("")).toBe(0x811c9dc5);
    expect(fnv1a("a")).toBe(0xe40c292c);
    expect(fnv1a("foobar")).toBe(0xbf9cf968);
  });

  it("gives an address the same hue whatever its case or spaces", () => {
    const hue = personHue("ada@example.com");
    expect(hue).toBeGreaterThanOrEqual(0);
    expect(hue).toBeLessThan(360);
    expect(personHue(" Ada@Example.COM ")).toBe(hue);
    expect(personHue("", "Ada")).toBe(personHue("ada"));
  });
});

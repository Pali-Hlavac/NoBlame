import { shortId } from "./format";

describe("shortId", () => {
  it("keeps the first eight characters", () => {
    expect(shortId("0123456789abcdef")).toBe("01234567");
  });
});

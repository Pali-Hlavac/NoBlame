import { EMPTY_DRAFT, amendOff, amendOn } from "./draft";

describe("amending", () => {
  it("fills in the last message only when nothing is typed", () => {
    expect(amendOn(EMPTY_DRAFT, "Subject\n\nBody\n\n")).toEqual({
      amend: true,
      message: "Subject\n\nBody",
      amendedMessage: "Subject\n\nBody",
    });
    expect(amendOn({ ...EMPTY_DRAFT, message: "Mine" }, "Subject")).toEqual({
      amend: true,
      amendedMessage: null,
    });
  });

  it("takes the filled-in message away unless it was edited", () => {
    const filled = { ...EMPTY_DRAFT, amend: true, message: "Subject", amendedMessage: "Subject" };
    expect(amendOff(filled)).toEqual({ amend: false, amendedMessage: null, message: "" });
    expect(amendOff({ ...filled, message: "Subject, edited" })).toEqual({
      amend: false,
      amendedMessage: null,
    });
  });
});

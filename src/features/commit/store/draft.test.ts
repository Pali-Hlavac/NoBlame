import { EMPTY_DRAFT, amendOff, amendOn, fromTemplate, typed } from "./draft";

describe("amending", () => {
  it("fills in the last message only when nothing is typed", () => {
    expect(amendOn(EMPTY_DRAFT, "Subject\n\nBody\n\n")).toEqual({
      amend: true,
      message: "Subject\n\nBody",
      amendedMessage: "Subject\n\nBody",
      template: null,
      seeded: true,
    });
    expect(amendOn({ ...EMPTY_DRAFT, message: "Mine" }, "Subject")).toEqual({
      amend: true,
      amendedMessage: null,
    });
  });

  it("takes the filled-in message away unless it was edited", () => {
    const filled = { ...EMPTY_DRAFT, amend: true, message: "Subject", amendedMessage: "Subject" };
    expect(amendOff(filled)).toEqual({
      amend: false,
      amendedMessage: null,
      message: "",
      seeded: false,
    });
    expect(amendOff({ ...filled, message: "Subject, edited" })).toEqual({
      amend: false,
      amendedMessage: null,
    });
  });
});

describe("the template", () => {
  const seeded = { ...EMPTY_DRAFT, ...fromTemplate("Summary\n\n# Why?\n") };

  it("is filled in without its trailing newlines and counts as nothing typed", () => {
    expect(seeded.message).toBe("Summary\n\n# Why?");
    expect(amendOn(seeded, "Old")).toEqual({
      amend: true,
      message: "Old",
      amendedMessage: "Old",
      template: null,
      seeded: true,
    });
  });

  it("stops counting once the box is emptied by hand", () => {
    expect(typed("")).toEqual({ message: "", template: null, seeded: true });
    expect(typed("Mine")).toEqual({ message: "Mine" });
  });
});

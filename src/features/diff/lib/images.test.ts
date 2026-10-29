import { imageType } from "./images";

describe("imageType", () => {
  it("knows image extensions in any case", () => {
    expect(imageType("assets/logo/noblame.png")).toBe("image/png");
    expect(imageType("photo.JPEG")).toBe("image/jpeg");
    expect(imageType("icons/app.ico")).toBe("image/x-icon");
  });

  it("leaves other files, SVG and dotted folders alone", () => {
    expect(imageType("logo.svg")).toBeUndefined();
    expect(imageType("README")).toBeUndefined();
    expect(imageType("build.png/output")).toBeUndefined();
  });
});

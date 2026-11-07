import { depthOf, folderNameOf, folderNameProblem, joinPath, parentOf } from "./clone";

describe("clone folder", () => {
  it("picks the name git would", () => {
    expect(folderNameOf("https://github.com/acme/rocket.git")).toBe("rocket");
    expect(folderNameOf("git@github.com:acme/rocket.git")).toBe("rocket");
    expect(folderNameOf("ssh://host/srv/rocket.git/")).toBe("rocket");
    expect(folderNameOf("https://dev.azure.com/acme/web/_git/portal")).toBe("portal");
    expect(folderNameOf("C:\\code\\rocket")).toBe("rocket");
    expect(folderNameOf("/srv/git/rocket/.git")).toBe("rocket");
    expect(folderNameOf("host:rocket.git")).toBe("rocket");
    expect(folderNameOf("")).toBe("");
  });

  it("joins and splits folders with their own separator", () => {
    expect(joinPath("C:\\code\\", "rocket")).toBe("C:\\code\\rocket");
    expect(joinPath("C:\\", "rocket")).toBe("C:\\rocket");
    expect(joinPath("/home/ada/src", "rocket")).toBe("/home/ada/src/rocket");
    expect(parentOf("C:\\code\\rocket")).toBe("C:\\code");
    expect(parentOf("C:\\rocket")).toBe("C:\\");
    expect(parentOf("/home/ada/rocket/")).toBe("/home/ada");
    expect(parentOf("/rocket")).toBe("/");
  });

  it("refuses names that are not one folder", () => {
    expect(folderNameProblem("rocket")).toBeNull();
    expect(folderNameProblem(" ")).not.toBeNull();
    expect(folderNameProblem("a/b")).not.toBeNull();
    expect(folderNameProblem("..")).not.toBeNull();
  });

  it("reads the number of commits of a shallow clone", () => {
    expect(depthOf("50")).toBe(50);
    expect(depthOf(" 1 ")).toBe(1);
    for (const text of ["", "0", "-2", "1.5", "abc", "2000000"]) expect(depthOf(text)).toBeNull();
  });
});

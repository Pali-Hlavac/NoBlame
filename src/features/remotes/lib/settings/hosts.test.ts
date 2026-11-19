import { azureOrganization, lfsEndpoint, otherProtocol, webPage } from "./hosts";

describe("remote hosts", () => {
  it("finds the web page", () => {
    expect(webPage("https://github.com/ada/app.git")).toBe("https://github.com/ada/app");
    expect(webPage("git@github.com:ada/app.git")).toBe("https://github.com/ada/app");
    expect(webPage("https://ada:***@gitlab.com/team/sub/app.git")).toBe(
      "https://gitlab.com/team/sub/app",
    );
    expect(webPage("https://org@dev.azure.com/org/Proj/_git/Repo")).toBe(
      "https://dev.azure.com/org/Proj/_git/Repo",
    );
    expect(webPage("git@ssh.dev.azure.com:v3/org/Proj/Repo")).toBe(
      "https://dev.azure.com/org/Proj/_git/Repo",
    );
    expect(webPage("https://org.visualstudio.com/DefaultCollection/Proj/_git/Repo")).toBe(
      "https://dev.azure.com/org/Proj/_git/Repo",
    );
    expect(webPage("https://git.example.com/a/b.git")).toBe("https://git.example.com/a/b");
    expect(webPage("git@git.example.com:a/b.git")).toBeNull();
    expect(webPage("C:/repos/app.git")).toBeNull();
  });

  it("switches between HTTPS and SSH for the known hosts", () => {
    expect(otherProtocol("https://github.com/ada/app.git")).toEqual({
      kind: "ssh",
      url: "git@github.com:ada/app.git",
    });
    expect(otherProtocol("git@bitbucket.org:team/app.git")).toEqual({
      kind: "https",
      url: "https://bitbucket.org/team/app.git",
    });
    expect(otherProtocol("https://dev.azure.com/org/Proj/_git/Repo")).toEqual({
      kind: "ssh",
      url: "git@ssh.dev.azure.com:v3/org/Proj/Repo",
    });
    expect(otherProtocol("org@vs-ssh.visualstudio.com:v3/org/Proj/Repo")).toEqual({
      kind: "https",
      url: "https://dev.azure.com/org/Proj/_git/Repo",
    });
    expect(otherProtocol("https://git.example.com/a/b.git")).toBeNull();
  });
});

describe("addresses derived from a remote's URL", () => {
  it("finds the Azure DevOps organization of an https URL", () => {
    expect(azureOrganization("https://contoso@dev.azure.com/contoso/Web/_git/app")).toBe("contoso");
    expect(azureOrganization("https://contoso.visualstudio.com/Web/_git/app")).toBe("contoso");
    expect(azureOrganization("git@ssh.dev.azure.com:v3/contoso/Web/app")).toBeNull();
    expect(azureOrganization("https://github.com/ada/app.git")).toBeNull();
  });

  it("works out the LFS server as git-lfs does", () => {
    expect(lfsEndpoint("https://ada@github.com/ada/app.git")).toBe(
      "https://github.com/ada/app.git/info/lfs",
    );
    expect(lfsEndpoint("https://dev.azure.com/c/Web/_git/app")).toBe(
      "https://dev.azure.com/c/Web/_git/app.git/info/lfs",
    );
    expect(lfsEndpoint("git@github.com:ada/app.git")).toBe(
      "https://github.com/ada/app.git/info/lfs",
    );
    expect(lfsEndpoint("ssh://git@git.example.com:2222/team/app")).toBe(
      "https://git.example.com/team/app.git/info/lfs",
    );
    expect(lfsEndpoint("C:/repos/app.git")).toBeNull();
  });
});

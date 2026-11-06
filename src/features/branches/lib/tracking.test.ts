import { describe, expect, it } from "vitest";

import {
  suggestedUpstream,
  trackingText,
  upstreamName,
  upstreamProblem,
  upstreamRef,
} from "./tracking";

describe("upstreamName", () => {
  it("drops the reference prefix", () => {
    expect(upstreamName("refs/remotes/origin/feature/x")).toBe("origin/feature/x");
    expect(upstreamName("refs/heads/main")).toBe("main");
    expect(upstreamName("odd")).toBe("odd");
  });
});

describe("trackingText", () => {
  const upstream = "refs/remotes/origin/main";

  it("says what is to push and pull", () => {
    expect(trackingText({ upstream, gone: false, counts: { ahead: 2, behind: 1 } })).toBe(
      "Tracks origin/main: 2 commits to push, 1 commit to pull",
    );
    expect(trackingText({ upstream, gone: false, counts: { ahead: 0, behind: 3 } })).toBe(
      "Tracks origin/main: 3 commits to pull",
    );
  });

  it("names an even, gone or not yet counted upstream", () => {
    expect(trackingText({ upstream, gone: false, counts: { ahead: 0, behind: 0 } })).toBe(
      "Up to date with origin/main",
    );
    expect(trackingText({ upstream, gone: true })).toBe("Its upstream origin/main is gone");
    expect(trackingText({ upstream, gone: false })).toBe("Tracks origin/main");
  });
});

describe("choosing an upstream", () => {
  const choices = {
    branches: new Set(["main", "topic"]),
    remotes: new Set(["origin/main", "fork/topic", "origin/topic"]),
  };

  it("finds remote and local branches", () => {
    expect(upstreamRef("origin/main", choices)).toBe("refs/remotes/origin/main");
    expect(upstreamRef("main", choices)).toBe("refs/heads/main");
    expect(upstreamRef("nope", choices)).toBeNull();
  });

  it("says what is wrong", () => {
    expect(upstreamProblem("", "topic", choices)).toMatch(/Enter/);
    expect(upstreamProblem("topic", "topic", choices)).toMatch(/itself/);
    expect(upstreamProblem("origin/nope", "topic", choices)).toMatch(/no branch/);
    expect(upstreamProblem("origin/topic", "topic", choices)).toBeNull();
  });

  it("suggests the current upstream, else origin's branch of the same name", () => {
    expect(suggestedUpstream("topic", "refs/remotes/fork/topic", choices.remotes)).toBe(
      "fork/topic",
    );
    expect(suggestedUpstream("topic", null, choices.remotes)).toBe("origin/topic");
    expect(suggestedUpstream("other", null, choices.remotes)).toBe("");
  });
});

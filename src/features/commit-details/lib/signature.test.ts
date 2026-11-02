import type { SignatureCheckDto } from "@/shared/ipc/bindings";

import { describeCheck } from "./signature";

const check = (overrides: Partial<SignatureCheckDto>): SignatureCheckDto => ({
  format: "openPgp",
  verdict: "good",
  signer: null,
  key: null,
  fingerprint: null,
  primaryFingerprint: null,
  trust: null,
  message: "",
  ...overrides,
});

describe("describeCheck", () => {
  it("colours verdicts by how much to worry", () => {
    expect(describeCheck(check({ verdict: "good" })).tone).toBe("good");
    expect(describeCheck(check({ verdict: "expiredKey" })).tone).toBe("warning");
    expect(describeCheck(check({ verdict: "bad" })).tone).toBe("bad");
    expect(describeCheck(check({ verdict: "revokedKey" })).tone).toBe("bad");
    expect(describeCheck(check({ verdict: "cannotCheck" })).tone).toBe("muted");
  });

  it("names the allowed signers for an unknown SSH key", () => {
    expect(describeCheck(check({ verdict: "unknownValidity", format: "ssh" })).title).toMatch(
      /allowed signers/,
    );
    expect(describeCheck(check({ verdict: "unknownValidity" })).title).toMatch(/not trusted/);
  });
});

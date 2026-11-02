/** Words and colours for a signature check. */
import type { SignatureCheckDto, SignatureFormatDto } from "@/shared/ipc/bindings";

export type SignatureTone = "good" | "warning" | "bad" | "muted";

/** The kind of signature, as people call it. */
export const FORMAT_NAMES: Record<SignatureFormatDto, string> = {
  openPgp: "GPG",
  ssh: "SSH",
  x509: "X.509",
  unknown: "Unrecognised",
};

/** One line saying what the check found, and how it should look. */
export function describeCheck(check: SignatureCheckDto): { title: string; tone: SignatureTone } {
  switch (check.verdict) {
    case "good":
      return { title: "Good signature", tone: "good" };
    case "unknownValidity":
      return {
        title:
          check.format === "ssh"
            ? "Good signature, but the key is not one of your allowed signers"
            : "Good signature, but the key is not trusted",
        tone: "warning",
      };
    case "expired":
      return { title: "Good signature, but it has expired", tone: "warning" };
    case "expiredKey":
      return { title: "Good signature, made with a key that has expired", tone: "warning" };
    case "revokedKey":
      return { title: "Signature made with a revoked key", tone: "bad" };
    case "bad":
      return { title: "Bad signature: the commit does not match it", tone: "bad" };
    case "cannotCheck":
      return { title: "Signed, but the signature could not be checked", tone: "muted" };
  }
}

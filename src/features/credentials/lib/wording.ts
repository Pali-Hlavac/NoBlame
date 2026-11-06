/** The words of a credential dialog for each kind of prompt. */
import type { CredentialKindDto } from "@/shared/ipc/bindings";

interface Wording {
  title: string;
  /** Label of the answer field. */
  label: string;
  submit: string;
}

const WORDING: Record<Exclude<CredentialKindDto, "hostKey">, Wording> = {
  username: { title: "Sign in", label: "User name", submit: "Continue" },
  password: { title: "Sign in", label: "Password or token", submit: "Sign in" },
  passphrase: { title: "Unlock SSH key", label: "Passphrase", submit: "Unlock" },
  other: { title: "Git asks", label: "Answer", submit: "Send" },
};

export function wordingOf(kind: Exclude<CredentialKindDto, "hostKey">): Wording {
  return WORDING[kind];
}

/** The last folder of a repository path. */
export function repositoryName(path: string): string {
  return (
    path
      .split(/[\\/]+/)
      .filter(Boolean)
      .at(-1) ?? path
  );
}

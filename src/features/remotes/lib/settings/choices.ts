/** Value lists of the editor's settings with a few values. */

/** A value and its words; `""` stands for "not set in this repository". */
export type Choice = readonly [value: string, label: string];

export const YES_NO: readonly Choice[] = [
  ["true", "Yes"],
  ["false", "No"],
];

export const TAG_CHOICES: readonly Choice[] = [
  ["--tags", "Every tag on the server"],
  ["--no-tags", "No tags"],
];

export const RECURSE_SUBMODULE_CHOICES: readonly Choice[] = [
  ["check", "Refuse when a submodule commit is not pushed yet"],
  ["on-demand", "Push the submodules first"],
  ["only", "Push only the submodules"],
  ["no", "Ignore submodules"],
];

export const PUSH_SIGN_CHOICES: readonly Choice[] = [
  ["true", "Always (fails when the server cannot check)"],
  ["if-asked", "When the server asks for it"],
  ["false", "Never"],
];

export const PROXY_AUTH_CHOICES: readonly Choice[] = [
  ["anyauth", "Whatever the proxy asks for"],
  ["basic", "Basic (user name and password)"],
  ["digest", "Digest"],
  ["negotiate", "Negotiate (Kerberos, your Windows account)"],
  ["ntlm", "NTLM (your Windows account)"],
];

export const SSL_BACKEND_CHOICES: readonly Choice[] = [
  ["schannel", "The Windows certificate store"],
  ["openssl", "Git's own certificate list (OpenSSL)"],
];

export const HTTP_VERSION_CHOICES: readonly Choice[] = [
  ["HTTP/2", "HTTP/2"],
  ["HTTP/1.1", "HTTP/1.1"],
];

/** "yes" / "no" for a boolean value as git reads it; undefined stays unknown. */
export function yesNo(value: string | undefined): string {
  if (value === undefined) return "no";
  return ["true", "yes", "on", "1"].includes(value.toLowerCase()) ? "yes" : "no";
}

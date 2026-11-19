/** What keeps the remote editor from saving, by setting id, in words. */
import type { RemoteSettingsDto } from "@/shared/ipc/bindings";

import { remoteNameProblem, urlProblem } from "../remotes";
import { type Draft, valuesOf } from "./draft";

/** The name of the settings a remote's custom keys may have: letters, digits and `-`. */
export function keyNameProblem(name: string): string | null {
  if (name === "") return "Enter the setting's name, such as tagOpt.";
  if (!/^[A-Za-z][A-Za-z0-9-]*$/.test(name)) {
    return "A setting's name has letters, digits and “-”, and starts with a letter.";
  }
  return null;
}

/** Problems by setting id; empty when the draft can be saved. */
export function draftProblems(
  base: RemoteSettingsDto,
  draft: Draft,
  otherRemotes: readonly string[],
): Map<string, string> {
  const problems = new Map<string, string>();
  const name = remoteNameProblem(draft.name, otherRemotes);
  if (name) problems.set("name", name);
  const [url] = valuesOf(base, draft, `remote.${base.name}.url`);
  const urlTrouble = urlProblem(url ?? "");
  if (urlTrouble) problems.set("url", urlTrouble);
  const pushUrls = valuesOf(base, draft, `remote.${base.name}.pushurl`);
  if (pushUrls.some((pushUrl) => pushUrl.trim() === "")) {
    problems.set("pushurl", "A push URL is empty: fill it in or remove it.");
  } else {
    const pushTrouble = pushUrls.map(urlProblem).find(Boolean);
    if (pushTrouble) problems.set("pushurl", pushTrouble);
  }
  return problems;
}

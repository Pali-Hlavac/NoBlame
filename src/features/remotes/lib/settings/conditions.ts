/**
 * When a setting of the remote editor applies, so the tabs show it and the search counts it
 * only then: HTTP(S) settings for http(s) URLs, Azure DevOps settings for its addresses,
 * Git Credential Manager's own when it is among the helpers, Windows-only ones on Windows.
 */
import type { RemoteSettingsDto } from "@/shared/ipc/bindings";
import { isWindowsPlatform } from "@/shared/lib/platform";

import { helperKind, helpersFor } from "./credentials";
import { type Draft, effectiveValue, emptyDraft, valuesOf } from "./draft";
import { azureOrganization, lfsEndpoint } from "./hosts";
import { serverOf } from "./urlKeyed";

export type Condition = (base: RemoteSettingsDto, draft: Draft) => boolean;

/** The remote's fetch URL, with the draft's change. */
export function remoteUrl(base: RemoteSettingsDto, draft: Draft): string {
  return valuesOf(base, draft, `remote.${base.name}.url`)[0] ?? "";
}

export const overHttp: Condition = (base, draft) =>
  serverOf(remoteUrl(base, draft))?.startsWith("http") ?? false;

export const onAzure: Condition = (base, draft) =>
  azureOrganization(remoteUrl(base, draft)) !== null;

/** Git Credential Manager is among the helpers git asks for the URL. */
export const withManager: Condition = (base, draft) =>
  overHttp(base, draft) &&
  helpersFor(base, draft, remoteUrl(base, draft)).helpers.some(
    (helper) => helperKind(helper.value).manager,
  );

export const onWindows: Condition = () => isWindowsPlatform();

/** The LFS server as saved (`remote.<name>.lfsurl`, else worked out from the saved URL). */
export function savedLfsServer(base: RemoteSettingsDto): string | null {
  const saved = emptyDraft(base);
  return (
    effectiveValue(base, saved, `remote.${base.name}.lfsurl`) ?? lfsEndpoint(remoteUrl(base, saved))
  );
}

export const hasLfsServer: Condition = (base) => savedLfsServer(base) !== null;

export function both(first: Condition, second: Condition): Condition {
  return (base, draft) => first(base, draft) && second(base, draft);
}

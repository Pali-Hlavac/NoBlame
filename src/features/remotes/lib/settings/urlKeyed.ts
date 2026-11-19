/**
 * Settings keyed by an address (`http.<url>.*`, `credential.<url>.*`) stop applying when a
 * remote's URL moves to another server. When the draft changes the URL's server (scheme, host,
 * port), the repository's own such settings for the old server are listed, and can be moved to
 * the new one (removed under the old key, written under the new) in the same save.
 */
import type { RemoteSettingsDto } from "@/shared/ipc/bindings";

import { type Draft, localValues, setValues, valuesOf } from "./draft";

/** `https://host:port` of a URL; null when it has none (`git@host:path`, a folder). */
export function serverOf(url: string | undefined): string | null {
  const match = /^([a-z][a-z0-9+.-]*:\/\/)(?:[^@/]+@)?([^/]+)/i.exec(url ?? "");
  return match?.[1] && match[2] ? `${match[1].toLowerCase()}${match[2].toLowerCase()}` : null;
}

export interface UrlKeyedSetting {
  /** The key now (`http.https://old.example/.proxy`). */
  key: string;
  /** The key for the new server. */
  newKey: string;
  values: readonly string[];
}

const KEYED = /^(http|credential)\.(.+)\.([a-z0-9-]+)$/i;

/** The repository's settings for the old server that the URL change leaves behind. */
export function staleUrlSettings(base: RemoteSettingsDto, draft: Draft): UrlKeyedSetting[] {
  const urlKey = `remote.${base.name}.url`;
  const before = serverOf(localValues(base, urlKey)[0]);
  const after = serverOf(valuesOf(base, draft, urlKey)[0]);
  if (!before || !after || before === after) return [];
  const seen = new Set<string>();
  const stale: UrlKeyedSetting[] = [];
  for (const entry of base.entries) {
    const match = KEYED.exec(entry.key);
    if (entry.scope !== "local" || !match?.[2] || seen.has(entry.key)) continue;
    const [, section, subsection, name] = match;
    if (serverOf(subsection) !== before || !section || !name) continue;
    seen.add(entry.key);
    const values = valuesOf(base, draft, entry.key);
    // Already moved (or removed) in the draft.
    if (values.length === 0) continue;
    const rest = subsection.slice(before.length);
    stale.push({ key: entry.key, newKey: `${section}.${after}${rest}.${name}`, values });
  }
  return stale;
}

/** The draft with `settings` moved to their new keys. */
export function moveUrlSettings(
  base: RemoteSettingsDto,
  draft: Draft,
  settings: readonly UrlKeyedSetting[],
): Draft {
  let next = draft;
  for (const setting of settings) {
    next = setValues(base, next, setting.key, []);
    const already = valuesOf(base, next, setting.newKey);
    next = setValues(base, next, setting.newKey, [...already, ...setting.values]);
  }
  return next;
}

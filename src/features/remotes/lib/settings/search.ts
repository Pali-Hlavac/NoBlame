/**
 * Searching the remote editor: every word of the query must appear in a setting's label, help,
 * git key, synonyms or tab name (case and accents ignored, as in the Settings tab). The
 * Advanced tab's keys are found by key and value. Matches come in tab order, so Enter can step
 * through them.
 */
import { normalize } from "@/features/settings";
import type { RemoteSettingsDto } from "@/shared/ipc/bindings";

import { canonicalKey, type Draft, inheritedValues, remoteKeys, valuesOf } from "./draft";
import { REMOTE_SETTINGS } from "./registry";
import { type RemoteTab, tabLabel, visibleTabs } from "./settingTypes";

export interface SearchMatch {
  readonly tab: RemoteTab;
  /** The setting's id, or `key:<key>` for a key of the Advanced tab. */
  readonly id: string;
}

export interface SearchResult {
  readonly matches: readonly SearchMatch[];
  readonly counts: ReadonlyMap<RemoteTab, number>;
}

/** The id of an Advanced tab key's row. */
export function keyMatchId(key: string): string {
  return `key:${canonicalKey(key)}`;
}

function found(words: readonly string[], parts: readonly string[]): boolean {
  const text = normalize(parts.join("\n"));
  return words.every((word) => text.includes(word));
}

/** The settings matching `query`; null for an empty query. */
export function searchRemote(
  query: string,
  base: RemoteSettingsDto,
  draft: Draft,
): SearchResult | null {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  const matches: SearchMatch[] = [];
  for (const tab of visibleTabs(base)) {
    for (const setting of REMOTE_SETTINGS) {
      if (setting.tab !== tab || (setting.applies && !setting.applies(base, draft))) continue;
      const parts = [
        setting.label,
        setting.help,
        setting.key?.(base.name) ?? "",
        tabLabel(tab),
        ...setting.synonyms,
      ];
      if (found(words, parts)) matches.push({ tab, id: setting.id });
    }
    if (tab !== "advanced") continue;
    for (const key of remoteKeys(base, draft)) {
      const values = [
        ...valuesOf(base, draft, key),
        ...inheritedValues(base, key).map((e) => e.value),
      ];
      if (found(words, [key, ...values])) matches.push({ tab, id: keyMatchId(key) });
    }
  }
  const counts = new Map<RemoteTab, number>();
  for (const match of matches) counts.set(match.tab, (counts.get(match.tab) ?? 0) + 1);
  return { matches, counts };
}

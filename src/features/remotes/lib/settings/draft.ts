/**
 * The remote editor's unsaved changes. `base` is what the editor read (every scope, secrets
 * hidden); the draft holds, per key, the repository's own values wanted instead. Nothing is
 * written until the review is confirmed; `toEdit` turns the draft into what the backend checks
 * against the file and applies all or nothing.
 */
import type { ConfigValueDto, RemoteEditDto, RemoteSettingsDto } from "@/shared/ipc/bindings";

/** A key as git lists it: section and name in lower case, the subsection as written. */
export function canonicalKey(key: string): string {
  const first = key.indexOf(".");
  const last = key.lastIndexOf(".");
  if (first < 0) return key.toLowerCase();
  if (first === last) return key.toLowerCase();
  return `${key.slice(0, first).toLowerCase()}${key.slice(first, last)}${key.slice(last).toLowerCase()}`;
}

export interface DraftKey {
  /** The key as it will be written (`remote.origin.tagOpt`). */
  readonly key: string;
  /** The repository's own values wanted, in order; none removes the key. */
  readonly values: readonly string[];
}

export interface Draft {
  /** The remote's name after saving. */
  readonly name: string;
  /** Its default branch after saving; null: not set. */
  readonly head: string | null;
  /** Changed keys, by canonical key. */
  readonly keys: ReadonlyMap<string, DraftKey>;
  /** The SSH key NoBlame uses for the remote (its own setting, not git's); null: none. */
  readonly sshKey: string | null;
}

export function emptyDraft(base: RemoteSettingsDto): Draft {
  return { name: base.name, head: base.head, keys: new Map(), sshKey: base.sshKey };
}

/** The values of `key` set in `scope` in what was read. */
function valuesIn(base: RemoteSettingsDto, key: string, local: boolean): ConfigValueDto[] {
  const wanted = canonicalKey(key);
  return base.entries.filter(
    (entry) => entry.key === wanted && (entry.scope === "local") === local,
  );
}

/** The repository's own values of `key` as read. */
export function localValues(base: RemoteSettingsDto, key: string): string[] {
  return valuesIn(base, key, true).map((entry) => entry.value);
}

/** Values of `key` from the other scopes (user, system, worktree), in the order git reads them. */
export function inheritedValues(base: RemoteSettingsDto, key: string): ConfigValueDto[] {
  return valuesIn(base, key, false);
}

/** The repository's own values of `key`, with the draft's change. */
export function valuesOf(base: RemoteSettingsDto, draft: Draft, key: string): readonly string[] {
  return draft.keys.get(canonicalKey(key))?.values ?? localValues(base, key);
}

/** The value git uses for a single-valued key: the last one set, the draft's counting as local. */
export function effectiveValue(
  base: RemoteSettingsDto,
  draft: Draft,
  key: string,
): string | undefined {
  const own = valuesOf(base, draft, key);
  if (own.length > 0) return own[own.length - 1];
  return inheritedValues(base, key)
    .filter((entry) => entry.scope !== "worktree")
    .at(-1)?.value;
}

function same(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/** The draft with `key` set to `values`; setting the values read drops the change. */
export function setValues(
  base: RemoteSettingsDto,
  draft: Draft,
  key: string,
  values: readonly string[],
): Draft {
  const keys = new Map(draft.keys);
  const id = canonicalKey(key);
  if (same(values, localValues(base, key))) keys.delete(id);
  else keys.set(id, { key: keys.get(id)?.key ?? key, values });
  return { ...draft, keys };
}

/** Every `remote.<name>.*` key read or drafted, sorted; spelled as written when drafted. */
export function remoteKeys(base: RemoteSettingsDto, draft: Draft): string[] {
  const prefix = `remote.${base.name}.`;
  const keys = new Map<string, string>();
  for (const entry of base.entries) {
    if (entry.key.startsWith(prefix)) keys.set(entry.key, entry.key);
  }
  for (const [id, change] of draft.keys) {
    if (id.startsWith(prefix)) keys.set(id, change.key);
  }
  return [...keys.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, key]) => key);
}

/** How many things the draft changes (keys, the default branch, the name). */
export function changeCount(base: RemoteSettingsDto, draft: Draft): number {
  return (
    draft.keys.size +
    (draft.head !== base.head ? 1 : 0) +
    (draft.name !== base.name ? 1 : 0) +
    (sshKeyChanged(base, draft) ? 1 : 0)
  );
}

/** Whether the draft changes the SSH key (saved apart from git's settings). */
export function sshKeyChanged(base: RemoteSettingsDto, draft: Draft): boolean {
  const key = draft.sshKey?.trim();
  return (key === "" ? null : (key ?? null)) !== base.sshKey;
}

/** Whether the draft changes anything git stores (keys, default branch, name). */
export function gitChanged(base: RemoteSettingsDto, draft: Draft): boolean {
  return draft.keys.size > 0 || draft.head !== base.head || draft.name !== base.name;
}

/** What the backend checks and saves. */
export function toEdit(base: RemoteSettingsDto, draft: Draft): RemoteEditDto {
  return {
    name: base.name,
    newName: draft.name !== base.name ? draft.name : null,
    head: draft.head !== base.head ? { before: base.head, after: draft.head } : null,
    keys: [...draft.keys.values()].map(({ key, values }) => ({
      key,
      before: localValues(base, key),
      after: [...values],
    })),
  };
}

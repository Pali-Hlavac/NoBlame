/**
 * Which credential helpers git asks for a URL, as git works it out: every `credential.helper`
 * and `credential.<url>.helper` whose URL matches (scheme, host with `*` labels, port, path
 * prefix, user), in the order git reads the files; an empty value drops the helpers before
 * it. The repository's own values come from the draft. And what each helper is, in words.
 */
import type { RemoteSettingsDto } from "@/shared/ipc/bindings";

import { type Draft, valuesOf } from "./draft";
import { scopeName } from "./words";

const DEFAULT_PORTS: Record<string, string> = { http: "80", https: "443" };
const URL_PARTS = /^([a-z][a-z0-9+.-]*):\/\/(?:([^@/]*)@)?([^/:]+)(?::(\d+))?(\/.*)?$/i;
const HELPER_KEY = /^credential\.(?:(.+)\.)?helper$/;

interface UrlParts {
  scheme: string | null;
  user: string | null;
  host: string;
  port: string | null;
  path: string;
}

function parts(url: string): UrlParts | null {
  const match = URL_PARTS.exec(url);
  if (match?.[1] && match[3]) {
    const scheme = match[1].toLowerCase();
    return {
      scheme,
      user: match[2] ? (match[2].split(":")[0] ?? null) : null,
      host: match[3].toLowerCase(),
      port: match[4] ?? DEFAULT_PORTS[scheme] ?? null,
      path: (match[5] ?? "").replace(/\/+$/, ""),
    };
  }
  // A partial URL (`example.com/team`): git matches it against the host and path.
  const [host, ...path] = url.split("/");
  if (!host) return null;
  const rest = path.join("/").replace(/\/+$/, "");
  return {
    scheme: null,
    user: null,
    host: host.toLowerCase(),
    port: null,
    path: rest ? `/${rest}` : "",
  };
}

function hostMatches(pattern: string, host: string): boolean {
  const want = pattern.split(".");
  const have = host.split(".");
  return (
    want.length === have.length && want.every((label, at) => label === "*" || label === have[at])
  );
}

/** Whether `credential.<pattern>.*` applies to `url`. */
export function appliesTo(pattern: string, url: string): boolean {
  const want = parts(pattern);
  const have = parts(url);
  if (!want || !have) return false;
  if (want.scheme && want.scheme !== have.scheme) return false;
  if (want.user && want.user !== have.user) return false;
  if (want.port && want.port !== have.port) return false;
  if (!hostMatches(want.host, have.host)) return false;
  return want.path === "" || have.path === want.path || have.path.startsWith(`${want.path}/`);
}

export interface HelperInUse {
  value: string;
  /** Where it is set, in words. */
  from: string;
}

export interface HelpersInUse {
  helpers: HelperInUse[];
  /** Where an empty value dropped the helpers set before it, when one did. */
  resetIn: string | null;
}

/** The helpers git asks for `url`, the draft's values standing for this repository's. */
export function helpersFor(base: RemoteSettingsDto, draft: Draft, url: string): HelpersInUse {
  const own = "this repository's settings";
  const local: HelperInUse[] = [];
  const outside: { before: HelperInUse[]; after: HelperInUse[] } = { before: [], after: [] };
  const seen = new Set<string>();
  for (const entry of base.entries) {
    const match = HELPER_KEY.exec(entry.key);
    if (!match || (match[1] !== undefined && !appliesTo(match[1], url))) continue;
    if (entry.scope === "local") {
      if (seen.has(entry.key)) continue;
      seen.add(entry.key);
      for (const value of valuesOf(base, draft, entry.key)) local.push({ value, from: own });
      continue;
    }
    const from = `${scopeName(entry.scope)}${entry.file ? ` (${entry.file})` : ""}`;
    (entry.scope === "worktree" ? outside.after : outside.before).push({
      value: entry.value,
      from,
    });
  }
  // Keys only the draft sets.
  for (const [id, change] of draft.keys) {
    const match = HELPER_KEY.exec(id);
    if (!match || seen.has(id) || (match[1] !== undefined && !appliesTo(match[1], url))) continue;
    for (const value of change.values) local.push({ value, from: own });
  }
  let helpers: HelperInUse[] = [];
  let resetIn: string | null = null;
  for (const helper of [...outside.before, ...local, ...outside.after]) {
    if (helper.value.trim() === "") {
      if (helpers.length > 0) resetIn = helper.from;
      helpers = [];
    } else helpers.push(helper);
  }
  return { helpers, resetIn };
}

export interface HelperKind {
  name: string;
  /** What it does with your sign-in. */
  about: string;
  /** Said in red: it keeps passwords unprotected. */
  warning?: string;
  manager: boolean;
}

/** What the helper `value` is. */
export function helperKind(value: string): HelperKind {
  const program = value.trim().split(/\s+/)[0] ?? "";
  const named = (name: string, about: string): HelperKind => ({ name, about, manager: false });
  // The whole value: a path to it may hold spaces (`C:/Program\ Files/…/git-credential-manager.exe`).
  if (/^manager(-core)?$/i.test(program) || /credential-manager/i.test(value)) {
    return {
      name: "Git Credential Manager",
      about:
        "Signs in through your browser or Windows and keeps the result in the system's credential store.",
      manager: true,
    };
  }
  if (program === "store") {
    return {
      ...named("store", "Keeps passwords in a file."),
      warning: "The file is not encrypted (~/.git-credentials unless --file says otherwise).",
    };
  }
  if (program === "cache")
    return named(
      "cache",
      "Keeps passwords in memory for a while (15 minutes unless --timeout says otherwise).",
    );
  if (/wincred/i.test(program))
    return named("wincred", "Keeps passwords in the Windows Credential Manager.");
  if (/osxkeychain/i.test(program))
    return named("osxkeychain", "Keeps passwords in the macOS keychain.");
  if (/libsecret|gnome-keyring/i.test(program))
    return named(program, "Keeps passwords in your desktop's keyring.");
  return named(program, "A program of its own.");
}

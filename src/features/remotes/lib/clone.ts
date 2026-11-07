/**
 * The clone dialog's choices, and its folder: the name git would pick for a URL, joined to the
 * folder that holds it.
 */
import type { CloneFilterDto } from "@/shared/ipc/bindings";

/** What the clone dialog's options choose. */
export interface CloneChoices {
  /** A branch or tag to check out instead of the default one (empty: the default). */
  branch: string;
  shallow: boolean;
  /** Commits kept when `shallow`, as typed (checked with `depthOf`). */
  depth: string;
  singleBranch: boolean;
  filter: CloneFilterDto;
  submodules: boolean;
  /** Open the repository in a tab when the clone succeeded. */
  open: boolean;
}

export const DEFAULT_CLONE_OPTIONS: CloneChoices = {
  branch: "",
  shallow: false,
  depth: "1",
  singleBranch: false,
  filter: "none",
  submodules: true,
  open: true,
};

/**
 * The folder `git clone <url>` would create: the URL's last part without `.git` (or `.bundle`),
 * for https and ssh URLs, `host:path` and local folders alike. Empty when there is none yet.
 */
export function folderNameOf(url: string): string {
  const trimmed = url
    .trim()
    .replace(/[/\\]+$/, "")
    .replace(/[/\\]\.git$/i, "")
    .replace(/\.(git|bundle)$/i, "");
  return (trimmed.split(/[/\\:]/).pop() ?? "").trim();
}

/** `parent` and `name` joined with the separator `parent` uses (`\` on Windows paths). */
export function joinPath(parent: string, name: string): string {
  const separator = parent.includes("\\") || /^[A-Za-z]:$/.test(parent) ? "\\" : "/";
  return `${parent.replace(/[/\\]+$/, "")}${separator}${name}`;
}

/** The folder that holds `path` (`C:\code` for `C:\code\app`, `C:\` for `C:\app`). */
export function parentOf(path: string): string {
  const parent = path.replace(/[/\\]+$/, "").replace(/[/\\][^/\\]*$/, "");
  if (/^[A-Za-z]:$/.test(parent)) return `${parent}\\`;
  return parent === "" && path.startsWith("/") ? "/" : parent;
}

/** Why `name` cannot be the new folder's name, or null when it can. */
export function folderNameProblem(name: string): string | null {
  if (name.trim() === "") return "Enter a name for the new folder.";
  if (/[/\\]/.test(name))
    return "The name cannot contain / or \\; choose the folder above it with Browse….";
  if (name === "." || name === "..") return "Choose a real name for the folder.";
  return null;
}

/** Most commits a shallow clone may ask for (git takes any number; more is no longer shallow). */
export const MAX_DEPTH = 1_000_000;

/** The number of commits typed, or null when it is not a whole number from 1 to `MAX_DEPTH`. */
export function depthOf(text: string): number | null {
  const depth = Number(text.trim());
  return Number.isInteger(depth) && depth >= 1 && depth <= MAX_DEPTH && text.trim() !== ""
    ? depth
    : null;
}

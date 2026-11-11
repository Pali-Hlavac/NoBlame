/** Words and names for patches and archives: file names proposed, the check, the toasts. */
import type {
  ApplyModeDto,
  PatchCountDto,
  PatchFileDto,
  PatchFitDto,
  PatchOutcomeDto,
} from "@/shared/ipc/bindings";

/** Longest slug of a subject in a proposed file name (git uses 64 for the whole name). */
const MAX_SLUG = 52;

/** `Fix-the-parser` from "Fix the parser!": letters, digits, dots and dashes only. */
export function slug(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9.]+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, MAX_SLUG)
    .replace(/-+$/, "");
}

/** The file name proposed for the patches of one commit, or of the commits after `base`. */
export function patchFileName(shortId: string, summary: string, base: string | null): string {
  if (base !== null) return `${slug(base) || "base"}..${shortId}.patch`;
  const subject = slug(summary);
  return subject ? `${shortId}-${subject}.patch` : `${shortId}.patch`;
}

function plural(count: number, one: string, many: string): string {
  return `${count.toLocaleString()} ${count === 1 ? one : many}`;
}

/** "3 commits (1 merge left out: a patch cannot hold a merge)". */
export function countText(count: PatchCountDto): string {
  const commits = plural(count.commits, "commit", "commits");
  if (count.merges === 0) return commits;
  return `${commits} (${plural(count.merges, "merge", "merges")} left out: a patch cannot hold a merge)`;
}

/** Whether every chosen file holds mails, so they can become commits (`git am`). */
export function allMailboxes(files: readonly PatchFileDto[]): boolean {
  return files.length > 0 && files.every((file) => file.contents.kind === "mailbox");
}

/** How many commits the chosen files' mails make. */
export function mailCount(files: readonly PatchFileDto[]): number {
  return files.reduce(
    (total, file) => total + (file.contents.kind === "mailbox" ? file.contents.mails.length : 0),
    0,
  );
}

/** What the check says, and how it looks. */
export function fitText(
  fit: PatchFitDto,
  mode: ApplyModeDto,
): { text: string; tone: "ok" | "warn" | "error" } {
  switch (fit.kind) {
    case "clean":
      return { text: "They apply cleanly.", tone: "ok" };
    case "threeWay":
      return {
        text:
          mode === "files"
            ? "They apply with a three-way merge (the files differ a little from what they expect); the changes are then staged."
            : "They apply with a three-way merge: the files differ a little from what they expect.",
        tone: "ok",
      };
    case "conflicts":
      return {
        text:
          mode === "files"
            ? "They apply with conflicts: the three-way merge leaves files for you to resolve."
            : "A mail conflicts: git am will stop there for you to resolve the files, then Continue in the bar above the commits.",
        tone: "warn",
      };
    case "fails":
      return { text: "They do not apply here.", tone: "error" };
  }
}

/** What the toast after applying says. */
export function applyToast(
  outcome: PatchOutcomeDto,
  commits: number,
): { title: string; description?: string; tone: "success" | "info" | "warning" } {
  switch (outcome) {
    case "committed":
      return {
        title: `Made ${plural(commits, "commit", "commits")} from the patches`,
        tone: "success",
      };
    case "stopped":
      return {
        title: "git am stopped on a patch that does not apply",
        description:
          "Resolve the conflicted files and stage them, then choose Continue in the bar above the commits (or Skip that patch, or Abort).",
        tone: "warning",
      };
    case "applied":
      return {
        title: "Applied the patches to the files",
        description: "The changes are not staged: review them in the Commit module.",
        tone: "success",
      };
    case "merged":
      return {
        title: "Applied the patches with a three-way merge",
        description: "The changes are staged: review them in the Commit module.",
        tone: "success",
      };
    case "conflicts":
      return {
        title: "The patches left conflicts",
        description: "Resolve the conflicted files in the Commit module, then stage them.",
        tone: "warning",
      };
  }
}

/** The archive's default file name, without the extension: `noblame-v1.0`. */
export function archiveBaseName(repository: string, name: string): string {
  const parts = [slug(repository), slug(name)].filter((part) => part.length > 0);
  return parts.join("-") || "archive";
}

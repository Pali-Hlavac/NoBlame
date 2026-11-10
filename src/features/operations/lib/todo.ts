/**
 * The interactive rebase's list as the editor holds it: the commits in their new order with
 * what to do with each, the messages typed, and the request built from them. Squash and fixup
 * fold a commit into the kept commit above it (its "group").
 */
import type { PlannedCommitDto, TodoActionDto, TodoStepDto } from "@/shared/ipc/bindings";

/** One commit in the editor. */
export interface TodoRow {
  commit: PlannedCommitDto;
  action: TodoActionDto;
}

/** New messages by the id of the commit that starts the group. */
export type TodoMessages = Readonly<Record<string, string | undefined>>;

/** The actions offered, with how each is named and explained. */
export const TODO_ACTIONS: readonly { action: TodoActionDto; label: string; detail: string }[] = [
  { action: "pick", label: "Pick", detail: "Keep the commit" },
  { action: "reword", label: "Reword", detail: "Keep it with a new message" },
  { action: "edit", label: "Edit", detail: "Stop after it, to amend it" },
  { action: "squash", label: "Squash", detail: "Fold into the commit above; combine messages" },
  { action: "fixup", label: "Fixup", detail: "Fold into the commit above; drop its message" },
  { action: "drop", label: "Drop", detail: "Leave the commit out" },
];

const FOLDS: ReadonlySet<TodoActionDto> = new Set(["squash", "fixup"]);

/** The first line of a message. */
export function subject(message: string): string {
  return message.split("\n", 1)[0] ?? "";
}

/** The rows with the one at `index` moved by `offset` (−1 up, +1 down); unchanged at an end. */
export function moveRow(rows: readonly TodoRow[], index: number, offset: number): TodoRow[] {
  const target = index + offset;
  const moved = [...rows];
  const row = moved[index];
  if (!row || target < 0 || target >= rows.length) return moved;
  moved.splice(index, 1);
  moved.splice(target, 0, row);
  return moved;
}

/**
 * For each row, the index of the kept row its group starts at (itself for pick, reword and
 * edit; the kept row above for squash and fixup; dropped rows belong to none: −1).
 */
export function groupHeads(rows: readonly TodoRow[]): number[] {
  let head = -1;
  return rows.map((row, index) => {
    if (row.action === "drop") return -1;
    if (!FOLDS.has(row.action)) head = index;
    return head;
  });
}

/** Whether the group starting at `head` gets a new message (reworded, or squashes in it). */
export function needsMessage(rows: readonly TodoRow[], head: number): boolean {
  const heads = groupHeads(rows);
  if (rows[head]?.action === "reword") return true;
  return rows.some((row, index) => heads[index] === head && row.action === "squash");
}

/**
 * The message a group starts with: its first commit's, then each squashed commit's. A
 * "squash! X" or "amend! X" subject line is left out (only its body is kept), as git does.
 */
export function defaultMessage(rows: readonly TodoRow[], head: number): string {
  const heads = groupHeads(rows);
  return rows
    .filter((row, index) => index === head || (heads[index] === head && row.action === "squash"))
    .map((row, at) => {
      const message = row.commit.message.trim();
      if (at === 0 || !AUTOSQUASH_PREFIX.test(subject(message))) return message;
      return message.split("\n").slice(1).join("\n").trim();
    })
    .filter((message) => message !== "")
    .join("\n\n");
}

/** Why the list cannot be run, or `null`. */
export function problem(rows: readonly TodoRow[]): string | null {
  const firstKept = rows.find((row) => row.action !== "drop");
  if (!firstKept) return "Every commit would be dropped. Use Reset instead.";
  if (FOLDS.has(firstKept.action)) {
    return "The first commit kept cannot be squashed or fixed up: there is no commit above it.";
  }
  return null;
}

/** Whether the list does anything: another order, or an action other than pick. */
export function changesAnything(
  rows: readonly TodoRow[],
  original: readonly PlannedCommitDto[],
): boolean {
  return rows.some((row, index) => row.action !== "pick" || row.commit.id !== original[index]?.id);
}

/** The message the group starting at `head` gets: the one typed, else the combined one. */
export function groupMessage(
  rows: readonly TodoRow[],
  head: number,
  messages: TodoMessages,
): string {
  const id = rows[head]?.commit.id;
  return (id === undefined ? undefined : messages[id]) ?? defaultMessage(rows, head);
}

/**
 * The steps sent to git. A group that is reworded or has squashes carries its message on its
 * first commit; a message typed for a commit that no longer needs one is not used.
 */
export function buildSteps(rows: readonly TodoRow[], messages: TodoMessages): TodoStepDto[] {
  const heads = groupHeads(rows);
  return rows.map((row, index) => ({
    action: row.action,
    commit: row.commit.id,
    message:
      heads[index] === index && needsMessage(rows, index)
        ? groupMessage(rows, index, messages)
        : null,
  }));
}

/** The prefixes `git commit --fixup` and `--squash` give a subject. */
const AUTOSQUASH_PREFIX = /^(fixup|squash|amend)! /;
/** An id prefix shorter than this is not taken as a commit id. */
const MIN_ID_PREFIX = 4;

/**
 * The list arranged as `git rebase --autosquash` would: each "fixup! X" commit moves right
 * after the commit above it whose subject is X (or whose id starts with X, or whose subject
 * starts with X), set to fixup; "squash! X" and "amend! X" become squash (the combined message
 * can then be edited).
 */
export function autosquash(rows: readonly TodoRow[]): TodoRow[] {
  const kept: { row: TodoRow; folded: TodoRow[] }[] = [];
  for (const row of rows) {
    const title = subject(row.commit.message);
    const match = AUTOSQUASH_PREFIX.exec(title);
    if (match) {
      let rest = title;
      while (AUTOSQUASH_PREFIX.test(rest)) rest = rest.replace(AUTOSQUASH_PREFIX, "");
      const target =
        kept.find((item) => subject(item.row.commit.message) === rest) ??
        kept.find((item) => rest.length >= MIN_ID_PREFIX && item.row.commit.id.startsWith(rest)) ??
        kept.find((item) => subject(item.row.commit.message).startsWith(rest));
      if (target) {
        target.folded.push({ ...row, action: match[1] === "fixup" ? "fixup" : "squash" });
        continue;
      }
    }
    kept.push({ row, folded: [] });
  }
  return kept.flatMap((item) => [item.row, ...item.folded]);
}

/** Whether any commit's subject asks to be folded into another ("fixup! ", "squash! "). */
export function hasAutosquash(rows: readonly TodoRow[]): boolean {
  return rows.some((row) => AUTOSQUASH_PREFIX.test(subject(row.commit.message)));
}

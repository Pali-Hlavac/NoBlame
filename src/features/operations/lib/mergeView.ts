/** The merged file put together from its chunks and the decisions taken in the merge view. */
import type { MergeChunkDto, UnmergeableDto } from "@/shared/ipc/bindings";

import type { DecisionHow, Decisions } from "../store/mergeView";

/** A conflict chunk. */
export type ConflictChunk = Extract<MergeChunkDto, { kind: "conflict" }>;

/** Why the view cannot merge a file, and what to do instead. */
export const UNMERGEABLE_WORDS: Readonly<Record<UnmergeableDto, string>> = {
  noConflict: "This file has no conflict (any more).",
  oneSided:
    "One side deleted this file, so there are no lines to merge. Keep or delete it with Use ours or Use theirs.",
  notAFile: "This is a symbolic link or a submodule. Take one side's version.",
  binary: "This file is binary. Take one side's version, or use your merge tool.",
  notUtf8: "This file is not UTF-8 text. Take one side's version, or use your merge tool.",
  tooLarge: "This file is too large to merge here (over 8 MB). Use your merge tool.",
  largeFileStorage:
    "This file is stored with Git LFS: its versions are pointers. Take one side's version.",
};

/** How each decision is named. */
export const HOW_WORDS: Readonly<Record<DecisionHow, string>> = {
  ours: "ours",
  theirs: "theirs",
  oursThenTheirs: "ours, then theirs",
  theirsThenOurs: "theirs, then ours",
  edited: "edited",
};

/** Texts put one after another, each starting on a line of its own. */
export function joinTexts(parts: readonly string[]): string {
  let joined = "";
  for (const part of parts) {
    if (part === "") continue;
    if (joined !== "" && !joined.endsWith("\n")) joined += "\n";
    joined += part;
  }
  return joined;
}

/** What `how` makes of `conflict` (an edit starts from both sides). */
export function textFor(how: DecisionHow, conflict: ConflictChunk): string {
  switch (how) {
    case "ours":
      return conflict.ours;
    case "theirs":
      return conflict.theirs;
    case "theirsThenOurs":
      return joinTexts([conflict.theirs, conflict.ours]);
    case "oursThenTheirs":
    case "edited":
      return joinTexts([conflict.ours, conflict.theirs]);
  }
}

/** The indices of the conflict chunks. */
export function conflictIndices(chunks: readonly MergeChunkDto[]): number[] {
  return chunks.flatMap((chunk, index) => (chunk.kind === "conflict" ? [index] : []));
}

/** The merged file, or `null` while a conflict is undecided. */
export function mergedText(chunks: readonly MergeChunkDto[], decisions: Decisions): string | null {
  const parts: string[] = [];
  for (const [index, chunk] of chunks.entries()) {
    if (chunk.kind === "resolved") {
      parts.push(chunk.text);
      continue;
    }
    const decision = decisions[index];
    if (!decision) return null;
    parts.push(decision.text);
  }
  return joinTexts(parts);
}

/** `text` without its last line ending, for showing it in a block. */
export function shownText(text: string): string {
  return text.replace(/\r?\n$/, "");
}

/** How many lines `text` has. */
export function lineCount(text: string): number {
  return text === "" ? 0 : shownText(text).split("\n").length;
}

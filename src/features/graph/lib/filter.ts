/** Labels and the reference list of the filter bar. */
import type { RefEntry, RefKindDto, RefLabel, TipsDto } from "@/shared/ipc/bindings";

/** At most this many references are listed in the branch picker; typing narrows them down. */
export const MAX_PICKER_REFS = 200;

/** Picker sections, in display order. */
const SECTIONS: readonly { kind: RefKindDto; title: string }[] = [
  { kind: "branch", title: "Branches" },
  { kind: "remote", title: "Remote branches" },
  { kind: "tag", title: "Tags" },
];

/** Text of the branch picker button. */
export function tipsLabel(tips: TipsDto, headName: string | undefined): string {
  switch (tips.type) {
    case "all":
      return "All branches";
    case "head":
      return headName === undefined ? "Current branch" : `Current branch (${headName})`;
    case "refs":
      return tips.refs.map((ref) => ref.name).join(", ") || "No branch";
  }
}

/** The branch HEAD is on, or `HEAD` when detached; undefined before the refs load. */
export function headNameOf(refs: readonly RefEntry[] | undefined): string | undefined {
  if (!refs) return undefined;
  return refs.find((entry) => entry.label.isHead)?.label.name ?? "HEAD";
}

export interface PickerSection {
  kind: RefKindDto;
  title: string;
  refs: RefEntry[];
}

/**
 * References whose name contains `query` (ignoring case), in sections, at most `limit` in all;
 * `hidden` counts the matches left out.
 */
export function pickerSections(
  refs: readonly RefEntry[],
  query: string,
  limit = MAX_PICKER_REFS,
): { sections: PickerSection[]; hidden: number } {
  const needle = query.trim().toLowerCase();
  let room = limit;
  let hidden = 0;
  const sections: PickerSection[] = [];
  for (const { kind, title } of SECTIONS) {
    const matches = refs.filter(
      (entry) => entry.label.kind === kind && entry.label.name.toLowerCase().includes(needle),
    );
    const shown = matches.slice(0, room);
    room -= shown.length;
    hidden += matches.length - shown.length;
    if (shown.length > 0) sections.push({ kind, title, refs: shown });
  }
  return { sections, hidden };
}

/** Whether `tips` names exactly the reference `label`. */
export function isChosen(tips: TipsDto, label: RefLabel): boolean {
  return (
    tips.type === "refs" &&
    tips.refs.some((ref) => ref.kind === label.kind && ref.name === label.name)
  );
}

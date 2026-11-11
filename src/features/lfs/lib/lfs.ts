/** Words for the Git LFS module. */
import type { LfsStateDto } from "@/shared/ipc/bindings";

function plural(count: number, one: string, many: string): string {
  return `${count.toLocaleString()} ${count === 1 ? one : many}`;
}

/** "12 files in Git LFS · 3 only as pointers". */
export function lfsSummary(state: LfsStateDto): string {
  const files = `${plural(state.total, "file", "files")} in Git LFS`;
  const pointers = state.files.filter((file) => !file.hasContent).length;
  return pointers === 0
    ? files
    : `${files} · ${plural(pointers, "only as a pointer", "only as pointers")}`;
}

import type { ColumnLayout } from "../lib/columns";

/** Column titles above the commit list (decorative: rows carry their own labels). */
export function GraphHeader({ columns }: { columns: ColumnLayout }) {
  return (
    <div
      className="grid h-7 shrink-0 items-center gap-3 border-b border-border pr-3 text-xs font-medium text-muted-foreground"
      style={{ gridTemplateColumns: columns.template }}
      aria-hidden
    >
      <span className="pl-2">Graph</span>
      <span>Message</span>
      {columns.visible.has("author") && <span>Author</span>}
      {columns.visible.has("date") && <span>Date</span>}
      {columns.visible.has("commit") && <span>Commit</span>}
    </div>
  );
}

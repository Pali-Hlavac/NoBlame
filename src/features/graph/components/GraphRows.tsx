import type { CommitRowDto } from "@/shared/ipc/bindings";
import { cn } from "@/shared/lib/cn";

import type { ColumnLayout } from "../lib/columns";
import { ROW_HEIGHT_PX } from "../lib/constants";
import { formatCommitDate, shortId } from "../lib/format";
import { RefBadge } from "./RefBadge";

interface GraphRowsProps {
  firstRow: number;
  lastRow: number;
  virtualTop: number;
  /** Columns shared with the column header. */
  columns: ColumnLayout;
  rowText: (row: number) => CommitRowDto | undefined;
  selected: number | undefined;
  onSelect: (row: number) => void;
  idPrefix: string;
}

/** Text columns of the visible rows, positioned over the canvas. */
export function GraphRows(props: GraphRowsProps) {
  const { firstRow, lastRow, virtualTop, columns, rowText, selected, onSelect, idPrefix } = props;
  const rows = Array.from(
    { length: Math.max(0, lastRow - firstRow + 1) },
    (_, index) => firstRow + index,
  );
  return rows.map((row) => {
    const text = rowText(row);
    const isSelected = row === selected;
    return (
      <div
        key={row}
        id={`${idPrefix}-${row}`}
        role="option"
        aria-selected={isSelected}
        tabIndex={-1}
        aria-label={text ? `${text.summary}, ${text.authorName}` : `Commit ${row + 1}, loading`}
        className={cn(
          "absolute right-0 left-0 grid items-center gap-3 pr-3 text-sm",
          isSelected ? "bg-accent text-accent-foreground" : "hover:bg-muted/60",
        )}
        style={{
          top: row * ROW_HEIGHT_PX - virtualTop,
          height: ROW_HEIGHT_PX,
          gridTemplateColumns: columns.template,
        }}
        onMouseDown={() => {
          onSelect(row);
        }}
      >
        <span aria-hidden />
        {text ? (
          <>
            <span className="flex min-w-0 items-center gap-1.5 overflow-hidden">
              {text.refs.map((label) => (
                <RefBadge key={`${label.kind}:${label.name}`} label={label} />
              ))}
              <span className="truncate">{text.summary}</span>
            </span>
            {columns.visible.has("author") && (
              <span className="truncate text-muted-foreground" title={text.authorEmail}>
                {text.authorName}
              </span>
            )}
            {columns.visible.has("date") && (
              <span className="truncate text-muted-foreground tabular-nums">
                {formatCommitDate(text.authorTime)}
              </span>
            )}
            {columns.visible.has("commit") && (
              <span className="font-mono text-xs text-muted-foreground">{shortId(text.id)}</span>
            )}
          </>
        ) : (
          <span className="col-[2/-1] h-2 w-48 max-w-full rounded bg-muted" />
        )}
      </div>
    );
  });
}

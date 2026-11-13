import type { CSSProperties, MouseEvent } from "react";

import { PersonBadge } from "@/shared/components/PersonBadge";
import type { CommitRowDto, DateDisplay, GraphColumnId } from "@/shared/ipc/bindings";
import { cn } from "@/shared/lib/cn";

import type { ColumnLayout } from "../lib/columns";
import { ROW_HEIGHT_PX } from "../lib/constants";
import type { DisplayRows } from "../lib/displayRows";
import { formatCommitDate, formatRelativeDate, shortId } from "../lib/format";
import { RefBadge } from "./RefBadge";
import { StashBadge } from "./StashBadge";

interface GraphRowsProps {
  /** Visible rows as display indexes (working tree rows first, then commits). */
  firstIndex: number;
  lastIndex: number;
  /** Top of the window in display coordinates. */
  virtualTop: number;
  rows: DisplayRows;
  /** Columns shared with the column header. */
  columns: ColumnLayout;
  /** How the date column shows dates, and the time relative dates count from. */
  dateDisplay: DateDisplay;
  /** The message column shows the rest of the message, greyed, after the subject. */
  showMessageBody: boolean;
  nowMs: number;
  /** Text of a commit, by graph row. */
  rowText: (row: number) => CommitRowDto | undefined;
  /** Display index of the selection. */
  selectedIndex: number | undefined;
  /** Author email (lower case) whose commits are marked, from the highlighted commit. */
  highlightAuthor?: string;
  onSelect: (index: number) => void;
  /** Ctrl+click (Cmd+click on macOS): compare the selected commit with this row's. */
  onCompare: (index: number) => void;
  idPrefix: string;
}

interface CommitCellProps {
  id: GraphColumnId;
  text: CommitRowDto;
  /** By the highlighted commit's author. */
  byAuthor: boolean;
  dateDisplay: DateDisplay;
  showMessageBody: boolean;
  nowMs: number;
}

/** One column of a commit row. */
function CommitCell(props: CommitCellProps) {
  const { id, text, byAuthor, dateDisplay, nowMs } = props;
  switch (id) {
    case "graph":
      // The canvas draws the graph below this empty cell.
      return <span aria-hidden />;
    case "message":
      return (
        <span className="flex min-w-0 items-center gap-1.5 overflow-hidden">
          {text.refs.map((label) => (
            <RefBadge key={`${label.kind}:${label.name}`} label={label} />
          ))}
          {text.stashes.map((stash) => (
            <StashBadge key={stash.index} stash={stash} />
          ))}
          <span className="truncate">
            {text.summary}
            {props.showMessageBody && text.body && (
              <span className="ml-2 text-muted-foreground">{text.body}</span>
            )}
          </span>
        </span>
      );
    case "author":
      return (
        <span
          className={cn(
            "flex min-w-0 items-center gap-1.5",
            byAuthor ? "font-medium text-foreground" : "text-muted-foreground",
          )}
          title={text.authorEmail}
        >
          <PersonBadge
            name={text.authorName}
            email={text.authorEmail}
            className="size-4 text-[0.5rem]"
          />
          <span className="truncate">{text.authorName}</span>
        </span>
      );
    case "date": {
      const absolute = formatCommitDate(text.authorTime);
      return dateDisplay === "relative" ? (
        <span className="truncate text-muted-foreground tabular-nums" title={absolute}>
          {formatRelativeDate(text.authorTime, nowMs)}
        </span>
      ) : (
        <span className="truncate text-muted-foreground tabular-nums">{absolute}</span>
      );
    }
    case "commit":
      return (
        <span className="truncate font-mono text-xs text-muted-foreground">{shortId(text.id)}</span>
      );
  }
}

const ROW_CLASS = "absolute right-0 left-0 grid items-center gap-3 pr-3 text-sm";

/** Text columns of the visible rows, positioned over the canvas. */
export function GraphRows(props: GraphRowsProps) {
  const { firstIndex, lastIndex, virtualTop, rows, columns, rowText, idPrefix } = props;
  const indexes = Array.from(
    { length: Math.max(0, lastIndex - firstIndex + 1) },
    (_, offset) => firstIndex + offset,
  );
  return indexes.map((index) => {
    const isSelected = index === props.selectedIndex;
    const style: CSSProperties = {
      top: index * ROW_HEIGHT_PX - virtualTop,
      height: ROW_HEIGHT_PX,
      gridTemplateColumns: columns.template,
    };
    const common = {
      id: `${idPrefix}-${index}`,
      "data-index": index,
      role: "option",
      "aria-selected": isSelected,
      tabIndex: -1,
      style,
      onMouseDown: (event: MouseEvent) => {
        if (event.button === 0 && (event.ctrlKey || event.metaKey)) props.onCompare(index);
        else props.onSelect(index);
      },
    } as const;
    const artificial = rows.artificial[index];
    if (artificial) {
      return (
        <div
          key={`working-tree-${artificial.kind}`}
          {...common}
          aria-label={`${artificial.title}: ${artificial.detail}`}
          className={cn(
            ROW_CLASS,
            isSelected ? "bg-accent text-accent-foreground" : "hover:bg-muted/60",
          )}
        >
          <span aria-hidden />
          <span className="col-[2/-1] truncate italic">
            {artificial.title}
            <span className="ml-2 text-muted-foreground not-italic">{artificial.detail}</span>
          </span>
        </div>
      );
    }
    const row = index - rows.offset;
    const text = rowText(row);
    const byAuthor =
      props.highlightAuthor !== undefined &&
      text?.authorEmail.toLowerCase() === props.highlightAuthor;
    return (
      <div
        key={row}
        {...common}
        aria-label={text ? `${text.summary}, ${text.authorName}` : `Commit ${row + 1}, loading`}
        className={cn(
          ROW_CLASS,
          isSelected
            ? "bg-accent text-accent-foreground"
            : cn("hover:bg-muted/60", byAuthor && "bg-primary/10"),
        )}
      >
        {text ? (
          columns.cells.map(({ id }) => (
            <CommitCell
              key={id}
              id={id}
              text={text}
              byAuthor={byAuthor}
              dateDisplay={props.dateDisplay}
              showMessageBody={props.showMessageBody}
              nowMs={props.nowMs}
            />
          ))
        ) : (
          <>
            <span aria-hidden />
            <span className="col-[2/-1] h-2 w-48 max-w-full rounded bg-muted" />
          </>
        )}
      </div>
    );
  });
}

import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import type { KeyboardEvent } from "react";

import { cn } from "@/shared/lib/cn";
import type { TodoActionDto } from "@/shared/ipc/bindings";
import { Button } from "@/shared/ui/button";

import {
  TODO_ACTIONS,
  type TodoMessages,
  type TodoRow,
  groupHeads,
  groupMessage,
  moveRow,
  needsMessage,
  subject,
} from "../lib/todo";

/** Shown digits of a commit id. */
const SHORT_ID_LENGTH = 8;
/** The message box grows with the text up to this many rows. */
const MAX_MESSAGE_ROWS = 10;

interface TodoListProps {
  rows: readonly TodoRow[];
  messages: TodoMessages;
  onRows: (rows: TodoRow[]) => void;
  onMessage: (commit: string, message: string) => void;
}

/**
 * The commits of an interactive rebase, oldest first: each can be moved (the arrow buttons, or
 * Alt+Up and Alt+Down in its action list) and given an action. A reworded commit, or one with squashes folded into
 * it, gets a box for its new message.
 */
export function TodoList({ rows, messages, onRows, onMessage }: TodoListProps) {
  const heads = groupHeads(rows);
  const move = (index: number, offset: number) => {
    const id = rows[index]?.commit.id;
    onRows(moveRow(rows, index, offset));
    // Reordering moves the row's elements, which loses focus: give it back to the row.
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-todo="${id ?? ""}"] select`)?.focus();
    });
  };
  const setAction = (index: number, action: TodoActionDto) => {
    onRows(rows.map((row, at) => (at === index ? { ...row, action } : row)));
  };

  return (
    <ol className="max-h-[50vh] divide-y divide-border overflow-auto rounded-md border border-border">
      {rows.map((row, index) => {
        const title = subject(row.commit.message);
        const folded = row.action === "squash" || row.action === "fixup";
        const onKeyDown = (event: KeyboardEvent) => {
          if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
          event.preventDefault();
          move(index, event.key === "ArrowUp" ? -1 : 1);
        };
        return (
          <li
            key={row.commit.id}
            data-todo={row.commit.id}
            className="flex flex-col gap-1 px-2 py-1 text-sm"
          >
            <div className="flex min-w-0 items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="size-7 p-0"
                aria-label={`Move ${title} up`}
                disabled={index === 0}
                onClick={() => {
                  move(index, -1);
                }}
              >
                <ArrowUpIcon className="size-4" aria-hidden />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="size-7 p-0"
                aria-label={`Move ${title} down`}
                disabled={index === rows.length - 1}
                onClick={() => {
                  move(index, 1);
                }}
              >
                <ArrowDownIcon className="size-4" aria-hidden />
              </Button>
              <select
                aria-label={`What to do with ${title}`}
                value={row.action}
                // Alt+Up and Alt+Down move the row (and do not open the list).
                onKeyDown={onKeyDown}
                onChange={(event) => {
                  setAction(index, event.target.value as TodoActionDto);
                }}
                className="border-input h-7 rounded-md border bg-background px-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {TODO_ACTIONS.map((option) => (
                  <option key={option.action} value={option.action} title={option.detail}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {row.commit.id.slice(0, SHORT_ID_LENGTH)}
              </span>
              <span
                className={cn(
                  "min-w-0 flex-1 truncate",
                  folded && "pl-3 text-muted-foreground",
                  row.action === "drop" && "text-muted-foreground line-through",
                )}
                title={row.commit.message}
              >
                {folded ? "↳ " : ""}
                {title}
              </span>
              <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                {row.commit.author}
              </span>
            </div>
            {heads[index] === index && needsMessage(rows, index) ? (
              <MessageBox
                label={`New message for ${title}`}
                value={groupMessage(rows, index, messages)}
                onChange={(message) => {
                  onMessage(row.commit.id, message);
                }}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function MessageBox(props: { label: string; value: string; onChange: (value: string) => void }) {
  const lines = props.value.split("\n").length;
  return (
    <textarea
      aria-label={props.label}
      spellCheck={false}
      value={props.value}
      rows={Math.min(MAX_MESSAGE_ROWS, lines + 1)}
      onChange={(event) => {
        props.onChange(event.target.value);
      }}
      className="border-input ml-16 resize-y rounded-md border bg-background px-2 py-1 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
    />
  );
}

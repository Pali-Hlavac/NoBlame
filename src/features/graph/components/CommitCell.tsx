import { PersonBadge } from "@/shared/components/PersonBadge";
import type { CommitRowDto, DateDisplay, GraphColumnId } from "@/shared/ipc/bindings";
import { cn } from "@/shared/lib/cn";

import type { SuperprojectLabelOf } from "../hooks/useSuperprojectLabels";
import type { LinkOf } from "../hooks/useUpstreamLinks";
import { formatCommitDate, formatRelativeDate, shortId } from "../lib/format";
import { RefBadge } from "./RefBadge";
import { StashBadge } from "./StashBadge";
import { SuperprojectBadge } from "./SuperprojectBadge";

export interface CommitCellProps {
  id: GraphColumnId;
  /** The commit's graph row. */
  row: number;
  text: CommitRowDto;
  linkOf: LinkOf;
  onFollow: (row: number) => void;
  /** In a submodule: the superproject's branches recording a row's commit. */
  superprojectOf: SuperprojectLabelOf;
  /** By the highlighted commit's author. */
  byAuthor: boolean;
  dateDisplay: DateDisplay;
  showMessageBody: boolean;
  nowMs: number;
}

/** One column of a commit row. */
export function CommitCell(props: CommitCellProps) {
  const { id, text, byAuthor, dateDisplay, nowMs } = props;
  const superproject = id === "message" ? props.superprojectOf(props.row) : undefined;
  switch (id) {
    case "graph":
      // The canvas draws the graph below this empty cell.
      return <span aria-hidden />;
    case "message":
      return (
        <span className="flex min-w-0 items-center gap-1.5 overflow-hidden">
          {text.refs.map((label) => {
            const to = props.linkOf(label);
            return (
              <RefBadge
                key={`${label.kind}:${label.name}`}
                label={label}
                link={
                  to && {
                    to,
                    up: to.row < props.row,
                    follow: () => {
                      props.onFollow(to.row);
                    },
                  }
                }
              />
            );
          })}
          {superproject && <SuperprojectBadge label={superproject} />}
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

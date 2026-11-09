import { InlineError } from "@/shared/components/InlineError";
import { Button } from "@/shared/ui/button";

interface MergeHeaderProps {
  path: string;
  names: { ours: string; theirs: string };
  decided: number;
  total: number;
  showBase: boolean;
  onShowBase: (show: boolean) => void;
  onNext: () => void;
  onRest: (side: "ours" | "theirs") => void;
  onStartOver: () => void;
  onSave: () => void;
  saving: boolean;
  error: unknown;
}

/** The merge tab's header: the file, who is who, how far along, and saving. */
export function MergeHeader(props: MergeHeaderProps) {
  const { decided, total } = props;
  const left = total - decided;
  return (
    <div className="flex flex-col gap-1 border-b border-border px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="min-w-0 truncate font-mono text-sm" title={props.path}>
          {props.path}
        </span>
        <span className="flex items-center gap-1 text-xs">
          <span aria-hidden className="size-2.5 rounded-sm bg-merge-ours" />
          Ours: {props.names.ours}
        </span>
        <span className="flex items-center gap-1 text-xs">
          <span aria-hidden className="size-2.5 rounded-sm bg-merge-theirs" />
          Theirs: {props.names.theirs}
        </span>
        <span className="flex items-center gap-1 text-xs">
          <span aria-hidden className="size-2.5 rounded-sm bg-merge-both" />
          Same on both
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground" role="status">
          {total === 0
            ? "Git left no conflicting lines: save to take the merged file."
            : `${String(decided)} of ${String(total)} conflicts decided`}
        </span>
        <label className="flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={props.showBase}
            onChange={(event) => {
              props.onShowBase(event.target.checked);
            }}
          />
          Show base
        </label>
        <span className="flex-1" />
        {left > 0 ? (
          <>
            <Button size="sm" variant="outline" className="h-7" onClick={props.onNext}>
              Next conflict
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={() => {
                props.onRest("ours");
              }}
            >
              Use ours for the rest
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={() => {
                props.onRest("theirs");
              }}
            >
              Use theirs for the rest
            </Button>
          </>
        ) : null}
        {decided > 0 ? (
          <Button size="sm" variant="ghost" className="h-7" onClick={props.onStartOver}>
            Start over
          </Button>
        ) : null}
        <Button
          size="sm"
          className="h-7"
          disabled={left > 0 || props.saving}
          title={left > 0 ? "Decide every conflict first" : undefined}
          onClick={props.onSave}
        >
          Save and mark resolved
        </Button>
      </div>
      {props.error ? <InlineError error={props.error} /> : null}
    </div>
  );
}

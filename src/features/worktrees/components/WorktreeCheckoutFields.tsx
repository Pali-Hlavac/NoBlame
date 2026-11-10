import { useId } from "react";

/** What the new worktree checks out, as the dialog's fields hold it. */
export interface CheckoutChoice {
  kind: "newBranch" | "branch" | "detached";
  /** The new branch's name, or the existing branch chosen. */
  name: string;
  /** Where a new branch starts. */
  start: string;
  /** The commit to check out without a branch. */
  revision: string;
}

const FIELD =
  "h-8 min-w-0 rounded-md border border-border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

const RADIO =
  "size-4 shrink-0 accent-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

interface WorktreeCheckoutFieldsProps {
  choice: CheckoutChoice;
  /** Local branches not checked out in any worktree. */
  free: readonly string[];
  onChange: (choice: CheckoutChoice) => void;
}

/** New branch (name, start), an existing branch, or a commit without a branch. */
export function WorktreeCheckoutFields({ choice, free, onChange }: WorktreeCheckoutFieldsProps) {
  const id = useId();
  const kind = (next: CheckoutChoice["kind"]) => {
    // An existing branch starts on the first free one; a new branch starts empty.
    const name = next === "branch" ? (free[0] ?? "") : next === "newBranch" ? "" : choice.name;
    onChange({ ...choice, kind: next, name });
  };
  const radio = (value: CheckoutChoice["kind"], label: string, disabled = false) => (
    <label className="flex items-center gap-1.5 text-sm">
      <input
        type="radio"
        name={`${id}-kind`}
        className={RADIO}
        checked={choice.kind === value}
        disabled={disabled}
        onChange={() => {
          kind(value);
        }}
      />
      {label}
    </label>
  );
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">Check out</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {radio("newBranch", "A new branch")}
        {radio("branch", "A branch", free.length === 0)}
        {radio("detached", "A commit, without a branch")}
      </div>
      {choice.kind === "newBranch" && (
        <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2">
          <label htmlFor={`${id}-name`} className="text-sm">
            Branch name
          </label>
          <input
            id={`${id}-name`}
            value={choice.name}
            spellCheck={false}
            autoComplete="off"
            className={`${FIELD} font-mono`}
            onChange={(event) => {
              onChange({ ...choice, name: event.target.value });
            }}
          />
          <label htmlFor={`${id}-start`} className="text-sm">
            Starting at
          </label>
          <input
            id={`${id}-start`}
            value={choice.start}
            spellCheck={false}
            autoComplete="off"
            className={`${FIELD} font-mono`}
            onChange={(event) => {
              onChange({ ...choice, start: event.target.value });
            }}
          />
        </div>
      )}
      {choice.kind === "branch" && (
        <select
          aria-label="Branch"
          value={choice.name}
          className={FIELD}
          onChange={(event) => {
            onChange({ ...choice, name: event.target.value });
          }}
        >
          {free.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      )}
      {choice.kind === "detached" && (
        <input
          aria-label="Commit"
          value={choice.revision}
          spellCheck={false}
          autoComplete="off"
          placeholder="A commit id, branch or tag"
          className={`${FIELD} font-mono`}
          onChange={(event) => {
            onChange({ ...choice, revision: event.target.value });
          }}
        />
      )}
      {free.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Every branch is checked out in a worktree already; Git checks out a branch in one worktree
          at a time.
        </p>
      )}
    </fieldset>
  );
}

import { useId } from "react";

import type { CloneFilterDto } from "@/shared/ipc/bindings";

import { MAX_DEPTH, type CloneChoices } from "../lib/clone";
import { Checkbox, FIELD } from "./form";

const FILTERS: readonly { value: CloneFilterDto; label: string }[] = [
  { value: "none", label: "Everything" },
  { value: "blobless", label: "File contents when needed (blobless)" },
  { value: "treeless", label: "Old commits' folders and files when needed (treeless)" },
];

/** Branch, shallow, single branch, partial clone, submodules and opening it afterwards. */
export function CloneOptions({
  choices,
  onChange,
}: {
  choices: CloneChoices;
  onChange: (choices: CloneChoices) => void;
}) {
  const id = useId();
  const set = (change: Partial<CloneChoices>) => {
    onChange({ ...choices, ...change });
  };
  return (
    <fieldset className="flex flex-col gap-2 rounded-md border border-border p-3">
      <legend className="px-1 text-xs text-muted-foreground">Options</legend>
      <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2">
        <label htmlFor={`${id}-branch`} className="text-sm">
          Branch
        </label>
        <input
          id={`${id}-branch`}
          value={choices.branch}
          placeholder="The remote's default"
          spellCheck={false}
          autoComplete="off"
          className={`${FIELD} font-mono`}
          onChange={(event) => {
            set({ branch: event.target.value });
          }}
        />
        <label htmlFor={`${id}-filter`} className="text-sm">
          Download
        </label>
        <select
          id={`${id}-filter`}
          value={choices.filter}
          className={FIELD}
          onChange={(event) => {
            const filter = FILTERS.find((option) => option.value === event.target.value);
            if (filter) set({ filter: filter.value });
          }}
        >
          {FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          checked={choices.shallow}
          onChange={(shallow) => {
            set({ shallow });
          }}
        >
          Only the newest commits:
        </Checkbox>
        <input
          type="number"
          min={1}
          max={MAX_DEPTH}
          aria-label="Number of commits"
          value={choices.depth}
          disabled={!choices.shallow}
          className={`${FIELD} w-24`}
          onChange={(event) => {
            set({ depth: event.target.value });
          }}
        />
      </div>
      <Checkbox
        checked={choices.singleBranch}
        onChange={(singleBranch) => {
          set({ singleBranch });
        }}
      >
        Only that branch (no other remote branches)
      </Checkbox>
      <Checkbox
        checked={choices.submodules}
        onChange={(submodules) => {
          set({ submodules });
        }}
      >
        Submodules too
      </Checkbox>
      <Checkbox
        checked={choices.open}
        onChange={(open) => {
          set({ open });
        }}
      >
        Open it when done
      </Checkbox>
    </fieldset>
  );
}

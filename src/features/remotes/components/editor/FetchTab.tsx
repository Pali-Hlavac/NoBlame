import { RefreshCwIcon, ScissorsIcon } from "lucide-react";
import { useId } from "react";

import type { RemoteSettingsDto } from "@/shared/ipc/bindings";
import { Button } from "@/shared/ui/button";

import { TAG_CHOICES, YES_NO, yesNo } from "../../lib/settings/choices";
import { type Draft, effectiveValue, setValues, valuesOf } from "../../lib/settings/draft";
import { chosenRefspecs, everyBranch, readFetch } from "../../lib/settings/refspecs";
import { remoteSetting } from "../../lib/settings/registry";
import { ChoiceSetting } from "./ChoiceSetting";
import { SettingRow } from "./SettingRow";
import { ValuesEditor } from "./ValuesEditor";

interface FetchTabProps {
  base: RemoteSettingsDto;
  draft: Draft;
  onChange: (draft: Draft) => void;
  problems: ReadonlyMap<string, string>;
  /** Fetches the remote now (with its saved settings); undefined when it cannot. */
  onFetch: ((prune: boolean) => void) | undefined;
}

/** What fetching brings from this remote, and cleaning up what is gone there. */
export function FetchTab({ base, draft, onChange, problems, onFetch }: FetchTabProps) {
  const id = useId();
  const key = (name: string) => `remote.${base.name}.${name}`;
  const refspecs = valuesOf(base, draft, key("fetch"));
  const choice = readFetch(base.name, refspecs);
  const setRefspecs = (values: readonly string[]) => {
    onChange(setValues(base, draft, key("fetch"), values));
  };
  const globalPrune = yesNo(effectiveValue(base, draft, "fetch.prune"));
  const globalPruneTags = yesNo(effectiveValue(base, draft, "fetch.pruneTags"));
  const skipped = [key("skipFetchAll"), key("skipDefaultUpdate")].some(
    (name) => yesNo(effectiveValue(base, draft, name)) === "yes",
  );
  const filter = effectiveValue(base, draft, key("partialclonefilter"));
  const promisor = yesNo(effectiveValue(base, draft, key("promisor"))) === "yes";
  const radio = "size-4 accent-primary focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="grid gap-5">
      <SettingRow
        setting={remoteSetting("fetch")}
        remote={base.name}
        controlId={`${id}-fetch`}
        group
      >
        <div role="radiogroup" aria-labelledby={`${id}-fetch`} className="grid gap-1.5 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              className={radio}
              checked={choice.kind === "all"}
              onChange={() => {
                setRefspecs([everyBranch(base.name)]);
              }}
            />
            Every branch
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              className={radio}
              checked={choice.kind === "chosen"}
              onChange={() => {
                setRefspecs(chosenRefspecs(base.name, [base.head ?? "main"]));
              }}
            />
            Only these branches (names, or patterns like release/*)
          </label>
          {choice.kind === "custom" ? (
            <label className="flex items-center gap-2">
              <input type="radio" className={radio} checked readOnly />
              Something else, written by hand: change it in the Advanced tab
            </label>
          ) : null}
        </div>
        {choice.kind === "chosen" ? (
          <ValuesEditor
            label="Branch to fetch"
            values={choice.branches}
            placeholder="main or release/*"
            addLabel="Add a branch"
            empty="No branch: fetching brings nothing here."
            onChange={(branches) => {
              setRefspecs(chosenRefspecs(base.name, branches));
            }}
          />
        ) : null}
        {problems.get("fetch") ? (
          <p className="text-xs text-destructive">{problems.get("fetch")}</p>
        ) : null}
      </SettingRow>
      <ChoiceSetting
        id="tagOpt"
        base={base}
        draft={draft}
        onChange={onChange}
        unset="Tags on the commits fetched (git's default)"
        choices={TAG_CHOICES}
      />
      <ChoiceSetting
        id="prune"
        base={base}
        draft={draft}
        onChange={onChange}
        unset={`As fetch.prune says (now: ${globalPrune})`}
        choices={YES_NO}
      />
      <ChoiceSetting
        id="pruneTags"
        base={base}
        draft={draft}
        onChange={onChange}
        unset={`As fetch.pruneTags says (now: ${globalPruneTags})`}
        choices={YES_NO}
        warn={(value) =>
          value === "true" || (value === "" && globalPruneTags === "yes")
            ? "Tags you made here and did not push are deleted at the next fetch that removes branches."
            : undefined
        }
      />
      <SettingRow
        setting={remoteSetting("skipFetchAll")}
        remote={base.name}
        controlId={`${id}-skip`}
      >
        <label className="flex items-center gap-2 text-sm">
          <input
            id={`${id}-skip`}
            type="checkbox"
            className="size-4 accent-primary focus-visible:ring-2 focus-visible:ring-ring"
            checked={skipped}
            onChange={(event) => {
              const values = event.target.checked ? ["true"] : [];
              const once = setValues(base, draft, key("skipFetchAll"), values);
              onChange(setValues(base, once, key("skipDefaultUpdate"), values));
            }}
          />
          Skip {base.name} in Fetch all (also sets skipDefaultUpdate, for git remote update)
        </label>
      </SettingRow>
      {promisor || filter ? (
        <SettingRow
          setting={remoteSetting("partialClone")}
          remote={base.name}
          controlId={`${id}-pc`}
          group
        >
          <p className="text-sm">
            This repository is a partial clone of {base.name}
            {filter ? ` (filter ${filter})` : ""}: what it left out is downloaded from there when
            needed.
          </p>
        </SettingRow>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <Button variant="outline" disabled={!onFetch} onClick={() => onFetch?.(false)}>
          <RefreshCwIcon aria-hidden />
          Fetch now
        </Button>
        <Button variant="outline" disabled={!onFetch} onClick={() => onFetch?.(true)}>
          <ScissorsIcon aria-hidden />
          Fetch and remove deleted branches now
        </Button>
        <p className="text-xs text-muted-foreground">Uses the saved settings.</p>
      </div>
    </div>
  );
}

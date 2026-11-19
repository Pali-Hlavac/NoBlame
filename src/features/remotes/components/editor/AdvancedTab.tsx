import { useId, useState } from "react";

import type { RemoteSettingsDto } from "@/shared/ipc/bindings";
import { Button } from "@/shared/ui/button";

import {
  canonicalKey,
  type Draft,
  inheritedValues,
  localValues,
  remoteKeys,
  setValues,
  valuesOf,
} from "../../lib/settings/draft";
import { keyNameProblem } from "../../lib/settings/problems";
import { keyMatchId } from "../../lib/settings/search";
import { FIELD } from "../form";
import { scopeName } from "../../lib/settings/words";
import { useHighlight } from "./highlight";
import { RewritesList } from "./RewritesList";
import { ValuesEditor } from "./ValuesEditor";

interface AdvancedTabProps {
  base: RemoteSettingsDto;
  draft: Draft;
  onChange: (draft: Draft) => void;
}

/** All of the remote's settings as git stores them, for what the other tabs do not show. */
export function AdvancedTab({ base, draft, onChange }: AdvancedTabProps) {
  const keys = remoteKeys(base, draft);
  return (
    <div className="grid gap-6">
      <section aria-labelledby="advanced-keys" className="grid gap-3">
        <div>
          <h3 id="advanced-keys" className="text-sm font-semibold">
            Settings of {base.name}
          </h3>
          <p className="text-xs text-muted-foreground">
            Every <code className="font-mono">remote.{base.name}.*</code> value. Values of this
            repository can be changed; those from your user or the system's settings are shown with
            their file. A hidden password (***) is kept when left as it is.
          </p>
        </div>
        <ul className="grid gap-3">
          {keys.map((key) => (
            <KeyItem
              key={canonicalKey(key)}
              base={base}
              draft={draft}
              name={key}
              onChange={onChange}
            />
          ))}
        </ul>
        <AddKey
          onAdd={(name, value) => {
            const key = `remote.${base.name}.${name}`;
            onChange(setValues(base, draft, key, [...valuesOf(base, draft, key), value]));
          }}
        />
      </section>
      <RewritesList base={base} draft={draft} />
    </div>
  );
}

function KeyItem(props: {
  base: RemoteSettingsDto;
  draft: Draft;
  name: string;
  onChange: (draft: Draft) => void;
}) {
  const { base, draft, name, onChange } = props;
  const id = useId();
  const changed = draft.keys.has(canonicalKey(name));
  const values = valuesOf(base, draft, name);
  const inherited = inheritedValues(base, name);
  const removed = changed && values.length === 0 && localValues(base, name).length > 0;
  const marked = useHighlight(keyMatchId(name));
  return (
    <li
      data-setting-id={keyMatchId(name)}
      className={`grid gap-1.5 rounded-md border p-2 ${changed ? "border-primary" : "border-border"} ${marked}`}
    >
      <label htmlFor={`${id}-0`} className="font-mono text-xs font-medium">
        {name}
        {changed ? <span className="ml-2 font-sans text-primary">changed</span> : null}
      </label>
      <ValuesEditor
        label={name}
        firstId={`${id}-0`}
        values={values}
        addLabel={values.length === 0 ? "Set in this repository" : "Add a value"}
        empty={removed ? "Removed from this repository when saved." : "Not set in this repository."}
        onChange={(next) => {
          onChange(setValues(base, draft, name, next));
        }}
      />
      {inherited.map((entry, index) => (
        // The same value may come from two files: the position is the identity.
        <p key={index} className="text-xs text-muted-foreground">
          From {scopeName(entry.scope)}
          {entry.file ? ` (${entry.file})` : ""}: <code className="font-mono">{entry.value}</code>
        </p>
      ))}
    </li>
  );
}

function AddKey({ onAdd }: { onAdd: (name: string, value: string) => void }) {
  const id = useId();
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const problem = name === "" ? null : keyNameProblem(name);
  return (
    <form
      aria-label="Add a setting"
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (name === "" || problem) return;
        onAdd(name, value);
        setName("");
        setValue("");
      }}
    >
      <label className="grid gap-1 text-xs font-medium" htmlFor={`${id}-name`}>
        Setting
        <input
          id={`${id}-name`}
          value={name}
          placeholder="tagOpt"
          spellCheck={false}
          className={`${FIELD} w-40 font-mono`}
          onChange={(event) => {
            setName(event.target.value.trim());
          }}
        />
      </label>
      <label className="grid flex-1 gap-1 text-xs font-medium" htmlFor={`${id}-value`}>
        Value
        <input
          id={`${id}-value`}
          value={value}
          spellCheck={false}
          className={`${FIELD} font-mono`}
          onChange={(event) => {
            setValue(event.target.value);
          }}
        />
      </label>
      <Button type="submit" variant="outline" size="sm" disabled={name === "" || problem !== null}>
        Add
      </Button>
      {problem ? <p className="w-full text-xs text-destructive">{problem}</p> : null}
    </form>
  );
}

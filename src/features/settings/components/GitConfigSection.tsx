import { useId, useState } from "react";

import { useActiveRepository } from "@/features/repositories";
import { Choice } from "@/shared/components/Choice";
import { InlineError } from "@/shared/components/InlineError";
import type { ConfigScopeDto } from "@/shared/ipc/bindings";
import { Button } from "@/shared/ui/button";

import { useGitConfig, useWriteGitConfig } from "../api/gitConfig";
import { KNOWN_SETTINGS, isKnown, keyProblem, settingValue } from "../lib/gitConfig";
import { ConfigRow } from "./ConfigRow";
import { Section } from "./SettingControls";

const FIELD =
  "h-7 min-w-0 rounded-md border border-border bg-background px-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring";

function GitConfigEditor({ repoId, repoName }: { repoId: number; repoName: string }) {
  const id = useId();
  const [scope, setScope] = useState<ConfigScopeDto>("local");
  const config = useGitConfig(repoId, scope);
  const write = useWriteGitConfig(repoId, scope);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const entries = config.data?.entries ?? [];
  const others = entries.filter((entry) => !isKnown(entry.key));
  const problem = keyProblem(newKey);
  const save = (key: string, value: string | null) => {
    write.mutate({ key, value });
  };

  return (
    <div className="space-y-3">
      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="sr-only">Which settings</legend>
        <Choice
          id={`${id}-local`}
          type="radio"
          name={`${id}-scope`}
          checked={scope === "local"}
          onChange={() => {
            setScope("local");
          }}
          label={`This repository's (${repoName})`}
          detail="Only this repository. They win over your user settings."
        />
        <Choice
          id={`${id}-global`}
          type="radio"
          name={`${id}-scope`}
          checked={scope === "global"}
          onChange={() => {
            setScope("global");
          }}
          label="Your user settings"
          detail="Every repository of your user account on this computer, unless one sets its own."
        />
      </fieldset>
      <p className="text-xs text-muted-foreground">
        {config.data
          ? config.data.path
            ? `File: ${config.data.path}`
            : "The file does not exist yet; saving a setting creates it."
          : null}
      </p>
      {config.error ? <InlineError error={config.error} /> : null}
      {write.error ? <InlineError error={write.error} /> : null}
      <ul aria-label="Common settings" className="divide-y divide-border">
        {KNOWN_SETTINGS.map((setting) => (
          <ConfigRow
            key={`${scope}:${setting.key}`}
            settingKey={setting.key}
            label={setting.label}
            description={setting.description}
            value={settingValue(entries, setting.key)}
            placeholder={setting.example}
            pending={write.isPending}
            onSave={(value) => {
              save(setting.key, value);
            }}
            onRemove={() => {
              save(setting.key, null);
            }}
          />
        ))}
      </ul>
      <h3 className="text-sm font-medium">Other settings in this file</h3>
      {others.length === 0 ? <p className="text-xs text-muted-foreground">None.</p> : null}
      <ul aria-label="Other settings" className="divide-y divide-border">
        {others.map((entry, index) => (
          <ConfigRow
            key={`${scope}:${entry.key}:${String(index)}`}
            settingKey={entry.key}
            value={entry.value}
            pending={write.isPending}
            onSave={(value) => {
              save(entry.key, value);
            }}
            onRemove={() => {
              save(entry.key, null);
            }}
          />
        ))}
      </ul>
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (problem) return;
          save(newKey.trim(), newValue);
          setNewKey("");
          setNewValue("");
        }}
      >
        <input
          aria-label="New setting name"
          placeholder="section.name"
          className={`${FIELD} w-56`}
          value={newKey}
          spellCheck={false}
          onChange={(event) => {
            setNewKey(event.target.value);
          }}
        />
        <input
          aria-label="New setting value"
          placeholder="value"
          className={`${FIELD} min-w-40 flex-1`}
          value={newValue}
          spellCheck={false}
          onChange={(event) => {
            setNewValue(event.target.value);
          }}
        />
        <Button
          type="submit"
          size="sm"
          className="h-7"
          disabled={problem !== null || write.isPending}
        >
          Add
        </Button>
        {newKey.trim() !== "" && problem ? (
          <p className="w-full text-xs text-destructive">{problem}</p>
        ) : null}
      </form>
    </div>
  );
}

/**
 * Git's own settings (`git config`), for the repository in view or for the user: the file named,
 * common settings explained, the others listed. Nothing is written until Save, Remove or Add.
 */
export function GitConfigSection() {
  const summary = useActiveRepository().summary;
  return (
    <Section title="Git settings">
      {summary ? (
        <GitConfigEditor key={summary.id} repoId={summary.id} repoName={summary.name} />
      ) : (
        <p className="text-xs text-muted-foreground">
          Open a repository to see its Git settings and yours.
        </p>
      )}
    </Section>
  );
}

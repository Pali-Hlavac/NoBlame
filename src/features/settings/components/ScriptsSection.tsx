import { Trash2Icon } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/shared/ui/button";

import { useAppSettings, useChangeSettings } from "../hooks/useAppSettings";
import { scriptProblem, withoutGit } from "../lib/scripts";
import { Section } from "./SettingControls";

const FIELD =
  "h-8 min-w-0 rounded-md border border-border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** The placeholders, as the help names them. */
const PLACEHOLDER_HELP =
  "{sha} the commit's id, {short} its short id, {subject} its subject, {branch} the branch checked out, {repo} the repository's folder.";

/**
 * User scripts: git commands with placeholders, run on a commit from its menu (More → Run a
 * script). Added here with a name and git's arguments; removed with the bin.
 */
export function ScriptsSection() {
  const id = useId();
  const scripts = useAppSettings().scripts;
  const change = useChangeSettings();
  const [name, setName] = useState("");
  const [command, setCommand] = useState("");
  const problem = scriptProblem(name, command, scripts);
  const dirty = name.trim() !== "" || command.trim() !== "";

  const save = (next: typeof scripts) => {
    change((current) => ({ ...current, scripts: next }));
  };

  return (
    <Section title="Scripts">
      <p className="text-xs text-muted-foreground">
        Git commands you run on a commit from its menu (More → Run a script); their output shows in
        the jobs list. Write git&apos;s arguments, for example{" "}
        <code className="font-mono">log --stat -1 {"{sha}"}</code>. Placeholders: {PLACEHOLDER_HELP}
      </p>
      {scripts.length > 0 ? (
        <ul aria-label="Scripts" className="space-y-1">
          {scripts.map((script) => (
            <li key={script.name} className="flex items-center gap-2 text-sm">
              <span className="w-40 shrink-0 truncate font-medium" title={script.name}>
                {script.name}
              </span>
              <code className="min-w-0 flex-1 truncate font-mono text-xs" title={script.command}>
                git {script.command}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label={`Remove the script ${script.name}`}
                onClick={() => {
                  save(scripts.filter((other) => other.name !== script.name));
                }}
              >
                <Trash2Icon aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (problem) return;
          save([...scripts, { name: name.trim(), command: withoutGit(command) }]);
          setName("");
          setCommand("");
        }}
      >
        <input
          aria-label="Script name"
          placeholder="Name, such as Show stats"
          className={`${FIELD} w-40`}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
          }}
        />
        <input
          aria-label="git arguments"
          aria-describedby={`${id}-problem`}
          placeholder="log --stat -1 {sha}"
          spellCheck={false}
          autoComplete="off"
          className={`${FIELD} min-w-48 flex-1 font-mono`}
          value={command}
          onChange={(event) => {
            setCommand(event.target.value);
          }}
        />
        <Button type="submit" size="sm" disabled={problem !== null}>
          Add the script
        </Button>
        {dirty && problem ? (
          <p id={`${id}-problem`} className="w-full text-xs text-destructive">
            {problem}
          </p>
        ) : null}
      </form>
    </Section>
  );
}

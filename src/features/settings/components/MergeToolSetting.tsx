import { useId } from "react";

import type { MergeToolKind } from "@/shared/ipc/bindings";

import { useDiffSettings } from "../hooks/useDiffSettings";
import { Choice } from "./SettingControls";

const TOOL_OPTIONS: readonly { value: MergeToolKind; label: string }[] = [
  { value: "git", label: "Git's merge tool (merge.tool in your Git config)" },
  { value: "vsCode", label: "Visual Studio Code" },
  { value: "beyondCompare", label: "Beyond Compare" },
  { value: "kDiff3", label: "KDiff3" },
  { value: "meld", label: "Meld" },
  { value: "p4Merge", label: "P4Merge" },
  { value: "named", label: "Another tool Git knows, by name" },
];

/** Which program "Open in merge tool" starts for a conflicted file. */
export function MergeToolSetting() {
  const id = useId();
  const [diff, changeDiff] = useDiffSettings();
  const tool = diff.mergeTool;
  return (
    <div className="space-y-2">
      <Choice
        legend="Merge tool for conflicts"
        options={TOOL_OPTIONS}
        value={tool.kind}
        onChange={(kind) => {
          changeDiff({ mergeTool: { ...tool, kind } });
        }}
      />
      {tool.kind === "named" && (
        <div className="space-y-1 pl-5">
          <label htmlFor={`${id}-name`} className="text-sm">
            Tool name
          </label>
          <input
            id={`${id}-name`}
            value={tool.name}
            spellCheck={false}
            placeholder="winmerge"
            aria-describedby={`${id}-help`}
            className="h-8 w-full rounded-md border border-border bg-background px-2 font-mono text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            onChange={(event) => {
              changeDiff({ mergeTool: { ...tool, name: event.target.value } });
            }}
          />
          <p id={`${id}-help`} className="text-xs text-muted-foreground">
            A tool from git mergetool --tool-help, or one you set up with mergetool.&lt;name&gt;.cmd
            in your Git config.
          </p>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        NoBlame starts it through git mergetool, which stages the file when you close the tool with
        the conflict resolved. Git keeps a .orig copy unless mergetool.keepBackup is false.
      </p>
    </div>
  );
}

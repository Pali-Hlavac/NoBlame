import { useId } from "react";

import type { ExternalDiffToolKind } from "@/shared/ipc/bindings";

import { useDiffSettings } from "../hooks/useDiffSettings";
import { Choice } from "./SettingControls";

const TOOL_OPTIONS: readonly { value: ExternalDiffToolKind; label: string }[] = [
  { value: "git", label: "Git's diff tool (diff.tool in your Git config)" },
  { value: "vsCode", label: "Visual Studio Code" },
  { value: "custom", label: "A command of your own" },
];

/** Which program "Open in diff tool" starts, and the command of a custom one. */
export function ExternalToolSetting() {
  const id = useId();
  const [diff, changeDiff] = useDiffSettings();
  const tool = diff.externalTool;
  return (
    <div className="space-y-2">
      <Choice
        legend="External diff tool"
        options={TOOL_OPTIONS}
        value={tool.kind}
        onChange={(kind) => {
          changeDiff({ externalTool: { ...tool, kind } });
        }}
      />
      {tool.kind === "custom" && (
        <div className="space-y-1 pl-5">
          <label htmlFor={`${id}-command`} className="text-sm">
            Command
          </label>
          <input
            id={`${id}-command`}
            value={tool.command}
            spellCheck={false}
            placeholder={'"C:/Program Files/WinMerge/WinMergeU.exe" -e -u'}
            aria-describedby={`${id}-help`}
            className="h-8 w-full rounded-md border border-border bg-background px-2 font-mono text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            onChange={(event) => {
              changeDiff({ externalTool: { ...tool, command: event.target.value } });
            }}
          />
          <p id={`${id}-help`} className="text-xs text-muted-foreground">
            Git runs it with the old and the new file added at the end, as git difftool --extcmd
            does. It must keep running until you close the tool.
          </p>
        </div>
      )}
    </div>
  );
}

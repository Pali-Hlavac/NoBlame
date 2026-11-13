import { describeFile } from "@/features/changed-files";
import { VirtualList } from "@/shared/components/VirtualList";
import type { WorkingFileDto } from "@/shared/ipc/bindings";

import { usePickedFiles } from "../hooks/usePickedFiles";
import type { StagingVerb } from "../lib/verbs";
import { StagingMenu } from "./StagingMenu";
import { StagingRow } from "./StagingRow";

/** Height of one row, in CSS pixels. */
const ROW_HEIGHT_PX = 26;

export interface StagingFilesProps {
  repoId: number;
  repoPath: string;
  title: string;
  files: readonly WorkingFileDto[];
  verb: StagingVerb;
  /** Rows show the folder before the name (Settings → Commit). */
  pathFirst: boolean;
  /** Path of the file shown in the diff, when it is in this list. */
  chosen: string | undefined;
  busy: boolean;
  onChoose: (file: WorkingFileDto) => void;
  /** Stages or unstages these files (one, or the chosen ones). */
  onToggle: (files: WorkingFileDto[]) => void;
  /** Throws these files' changes away (after asking); the Changes list only. */
  onDiscard?: (files: WorkingFileDto[]) => void;
  /** Adds an untracked file to an ignore file (after asking how). */
  onIgnore?: (file: WorkingFileDto) => void;
}

/**
 * The rows of a Commit list. Several files can be chosen (Ctrl, Shift, Ctrl+Shift with a click
 * or the arrows, Ctrl+A); Space, the row buttons and the menu then act on all of them. The
 * cursor's file is the one whose diff shows.
 */
export function StagingFiles(props: StagingFilesProps) {
  const { files, verb, chosen, busy, onChoose, onToggle, onDiscard, onIgnore } = props;
  const activeIndex = chosen === undefined ? -1 : files.findIndex((file) => file.path === chosen);
  const picks = usePickedFiles(files, chosen);
  const many = picks.chosen.size > 1;
  return (
    <StagingMenu
      repoId={props.repoId}
      repoPath={props.repoPath}
      file={files[activeIndex]}
      files={picks.current}
      verb={verb.label}
      busy={busy}
      onChoose={onChoose}
      onToggle={onToggle}
      onDiscard={onDiscard}
      onIgnore={onIgnore}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <VirtualList
          className="flex-1"
          label={props.title}
          count={files.length}
          rowHeight={ROW_HEIGHT_PX}
          activeIndex={activeIndex < 0 ? undefined : activeIndex}
          selected={(index) => picks.chosen.has(files[index]?.path ?? "")}
          onActiveChange={(index, gesture) => {
            const file = files[index];
            if (!file) return;
            picks.move(index, gesture);
            onChoose(file);
          }}
          onActivate={(index) => {
            const file = files[index];
            if (file) onChoose(file);
          }}
          onKey={(key, index, event) => {
            const ctrl = event.ctrlKey || event.metaKey;
            if (ctrl && key.toLowerCase() === "a") {
              picks.chooseAll();
              return true;
            }
            if (key !== " " || index === undefined || busy) return false;
            if (ctrl) picks.toggleCursor();
            else if (picks.current.length > 0) onToggle(picks.current);
            return true;
          }}
          rowLabel={(index) => {
            const file = files[index];
            return file ? describeFile(file) : "";
          }}
          renderRow={(index, active) => {
            const file = files[index];
            if (!file) return null;
            const actedOn = picks.actedOn(file);
            return (
              <StagingRow
                file={file}
                active={active}
                selected={picks.chosen.has(file.path)}
                many={many}
                count={actedOn.length}
                pathFirst={props.pathFirst}
                verb={verb}
                busy={busy}
                onToggle={() => {
                  onToggle(actedOn);
                }}
                onDiscard={
                  onDiscard &&
                  (() => {
                    onDiscard(actedOn);
                  })
                }
                onIgnore={
                  onIgnore &&
                  (() => {
                    onIgnore(file);
                  })
                }
              />
            );
          }}
        />
      </div>
    </StagingMenu>
  );
}

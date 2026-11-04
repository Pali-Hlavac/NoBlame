import { CheckSquareIcon, SquareIcon } from "lucide-react";
import { useState, type MouseEvent } from "react";

import { ChangedFileRow, describeFile, type ListedFile } from "@/features/changed-files";
import { VirtualList } from "@/shared/components/VirtualList";
import { cn } from "@/shared/lib/cn";

/** Height of one row, in CSS pixels (as in Changed files). */
const ROW_HEIGHT_PX = 26;

interface CheckedFilesProps<F extends ListedFile> {
  label: string;
  files: readonly F[];
  keyOf: (file: F) => string;
  /** Keys of the files ticked. */
  checked: readonly string[];
  onCheck: (keys: string[], checked: boolean) => void;
  /** The file shown (its diff), when the list shows one; clicking a row then shows it. */
  shown?: string | undefined;
  onShow?: (file: F) => void;
  className?: string;
}

/** The row's own press must not also choose the row. */
function stopRowPress(event: MouseEvent): void {
  event.stopPropagation();
}

/**
 * Files with a tick box each. Space ticks the active row; a click on a row shows it when the
 * list shows files (`onShow`), else ticks it.
 */
export function CheckedFiles<F extends ListedFile>(props: CheckedFilesProps<F>) {
  const { files, keyOf, checked, onCheck, shown, onShow } = props;
  const [own, setOwn] = useState<string | undefined>(undefined);
  const activeKey = onShow ? shown : own;
  const activeIndex = activeKey === undefined ? -1 : files.findIndex((f) => keyOf(f) === activeKey);
  const isChecked = (file: F): boolean => checked.includes(keyOf(file));
  const toggle = (file: F): void => {
    onCheck([keyOf(file)], !isChecked(file));
  };

  return (
    <VirtualList
      className={props.className}
      label={props.label}
      count={files.length}
      rowHeight={ROW_HEIGHT_PX}
      activeIndex={activeIndex < 0 ? undefined : activeIndex}
      onActiveChange={(index) => {
        const file = files[index];
        if (!file) return;
        if (onShow) onShow(file);
        else setOwn(keyOf(file));
      }}
      onActivate={(index) => {
        const file = files[index];
        if (!file) return;
        if (onShow) onShow(file);
        else {
          setOwn(keyOf(file));
          toggle(file);
        }
      }}
      onKey={(key, index) => {
        const file = index === undefined ? undefined : files[index];
        if (key !== " " || !file) return false;
        toggle(file);
        return true;
      }}
      rowLabel={(index) => {
        const file = files[index];
        if (!file) return "";
        return `${describeFile(file)}, ${isChecked(file) ? "chosen" : "not chosen"}`;
      }}
      renderRow={(index, active) => {
        const file = files[index];
        if (!file) return null;
        const ticked = isChecked(file);
        const Icon = ticked ? CheckSquareIcon : SquareIcon;
        return (
          <div className={cn("flex h-full items-center", active && "bg-accent")}>
            <button
              type="button"
              tabIndex={-1}
              role="checkbox"
              aria-checked={ticked}
              aria-label={`Choose ${file.path}`}
              title="Choose (Space)"
              className="flex h-full shrink-0 items-center pl-2 text-muted-foreground hover:text-foreground"
              onMouseDown={stopRowPress}
              onClick={() => {
                toggle(file);
              }}
            >
              <Icon className={cn("size-4", ticked && "text-primary")} aria-hidden />
            </button>
            <div className="min-w-0 flex-1">
              <ChangedFileRow file={file} active={active} />
            </div>
          </div>
        );
      }}
    />
  );
}

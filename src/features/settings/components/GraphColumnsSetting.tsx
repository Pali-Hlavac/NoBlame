import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";

import { Button } from "@/shared/ui/button";

import { useGraphColumns } from "../hooks/useGraphColumns";
import {
  DATE_DISPLAY_OPTIONS,
  GRAPH_COLUMN_TITLES,
  isHideable,
  shiftColumn,
  updateColumn,
} from "../lib/graphColumns";
import { Choice } from "./SettingControls";

/** The commit list's columns: shown or not, and their order; plus how dates look. */
export function GraphColumnsSetting() {
  const { columns, dateDisplay, setColumns, setDateDisplay, resetColumns } = useGraphColumns();
  return (
    <>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Columns</legend>
        <p className="text-xs text-muted-foreground">
          In the commit list you can also drag a column title to move it, drag its edge to resize
          it, and right-click the titles for this list.
        </p>
        <ul className="space-y-1">
          {columns.map((column, index) => {
            const title = GRAPH_COLUMN_TITLES[column.id];
            // The graph stays first, so nothing moves above the second column.
            const canMoveUp = index > 1;
            const canMoveDown = column.id !== "graph" && index < columns.length - 1;
            return (
              <li key={column.id} className="flex items-center gap-2 text-sm">
                <label className="flex flex-1 items-center gap-1.5">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    checked={column.visible}
                    disabled={!isHideable(column.id)}
                    onChange={(event) => {
                      setColumns(
                        updateColumn(columns, column.id, { visible: event.target.checked }),
                      );
                    }}
                  />
                  {title}
                </label>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  aria-label={`Move ${title} up`}
                  disabled={!canMoveUp}
                  onClick={() => {
                    setColumns(shiftColumn(columns, column.id, -1));
                  }}
                >
                  <ArrowUpIcon aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  aria-label={`Move ${title} down`}
                  disabled={!canMoveDown}
                  onClick={() => {
                    setColumns(shiftColumn(columns, column.id, 1));
                  }}
                >
                  <ArrowDownIcon aria-hidden />
                </Button>
              </li>
            );
          })}
        </ul>
        <Button variant="outline" size="sm" onClick={resetColumns}>
          Reset columns
        </Button>
      </fieldset>
      <Choice
        legend="Dates"
        options={DATE_DISPLAY_OPTIONS}
        value={dateDisplay}
        onChange={setDateDisplay}
        inline
      />
    </>
  );
}

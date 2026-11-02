import { Columns3Icon } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

import {
  DATE_DISPLAY_OPTIONS,
  GRAPH_COLUMN_TITLES,
  isHideable,
  updateColumn,
  useGraphColumns,
} from "@/features/settings";
import type { DateDisplay } from "@/shared/ipc/bindings";
import { Button } from "@/shared/ui/button";
import {
  ContextMenuCheckboxItem,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
} from "@/shared/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";

interface CheckboxProps {
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
  onSelect: (event: Event) => void;
  children: ReactNode;
}

/** The parts of a Radix menu the column items use: a right-click menu or a dropdown. */
interface MenuKit {
  Label: ComponentType<{ children: ReactNode }>;
  CheckboxItem: ComponentType<CheckboxProps>;
  RadioGroup: ComponentType<{
    value: string;
    onValueChange: (value: string) => void;
    children: ReactNode;
  }>;
  RadioItem: ComponentType<{ value: string; children: ReactNode }>;
  Separator: ComponentType;
  Item: ComponentType<{ onSelect: () => void; children: ReactNode }>;
}

const CONTEXT_KIT: MenuKit = {
  Label: ContextMenuLabel,
  CheckboxItem: ContextMenuCheckboxItem,
  RadioGroup: ContextMenuRadioGroup,
  RadioItem: ContextMenuRadioItem,
  Separator: ContextMenuSeparator,
  Item: ContextMenuItem,
};

const DROPDOWN_KIT: MenuKit = {
  Label: DropdownMenuLabel,
  CheckboxItem: DropdownMenuCheckboxItem,
  RadioGroup: DropdownMenuRadioGroup,
  RadioItem: DropdownMenuRadioItem,
  Separator: DropdownMenuSeparator,
  Item: DropdownMenuItem,
};

function ColumnMenuItems({ kit }: { kit: MenuKit }) {
  const { columns, dateDisplay, setColumns, setDateDisplay, resetColumns } = useGraphColumns();
  return (
    <>
      <kit.Label>Columns</kit.Label>
      {columns.map((column) => (
        <kit.CheckboxItem
          key={column.id}
          checked={column.visible}
          disabled={!isHideable(column.id)}
          onCheckedChange={(visible) => {
            setColumns(updateColumn(columns, column.id, { visible }));
          }}
          // Stay open, so several columns can be switched in one go.
          onSelect={(event) => {
            event.preventDefault();
          }}
        >
          {GRAPH_COLUMN_TITLES[column.id]}
        </kit.CheckboxItem>
      ))}
      <kit.Separator />
      <kit.Label>Dates</kit.Label>
      <kit.RadioGroup
        value={dateDisplay}
        onValueChange={(value) => {
          setDateDisplay(value as DateDisplay);
        }}
      >
        {DATE_DISPLAY_OPTIONS.map((option) => (
          <kit.RadioItem key={option.value} value={option.value}>
            {option.label}
          </kit.RadioItem>
        ))}
      </kit.RadioGroup>
      <kit.Separator />
      <kit.Item onSelect={resetColumns}>Reset columns</kit.Item>
    </>
  );
}

/** Items of the column header's right-click menu. */
export function ColumnContextMenuItems() {
  return <ColumnMenuItems kit={CONTEXT_KIT} />;
}

/** The button at the end of the column header that opens the same menu. */
export function ColumnMenuButton() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-5 text-muted-foreground [&_svg]:size-3.5"
          aria-label="Columns"
          title="Columns and dates"
        >
          <Columns3Icon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <ColumnMenuItems kit={DROPDOWN_KIT} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

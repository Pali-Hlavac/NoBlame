import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";

import { VirtualList } from "./VirtualList";

const ROWS = 10_000;

function Harness({ onActivate }: { onActivate: (index: number) => void }) {
  const [active, setActive] = useState<number>();
  return (
    <VirtualList
      label="Items"
      count={ROWS}
      rowHeight={20}
      activeIndex={active}
      onActiveChange={setActive}
      onActivate={onActivate}
      rowLabel={(index) => `Item ${index}`}
      renderRow={(index) => <span>Item {index}</span>}
    />
  );
}

describe("VirtualList", () => {
  it("renders only a window of rows, not all of them", () => {
    render(<Harness onActivate={vi.fn()} />);
    expect(screen.getAllByRole("option").length).toBeLessThan(50);
  });

  it("moves with the keyboard and activates with Enter or the mouse", () => {
    const onActivate = vi.fn();
    render(<Harness onActivate={onActivate} />);
    const list = screen.getByRole("listbox", { name: "Items" });
    fireEvent.keyDown(list, { key: "ArrowDown" });
    fireEvent.keyDown(list, { key: "ArrowDown" });
    expect(screen.getByRole("option", { name: "Item 1" })).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(list, { key: "Enter" });
    expect(onActivate).toHaveBeenLastCalledWith(1);
    fireEvent.mouseDown(screen.getByRole("option", { name: "Item 3" }));
    expect(onActivate).toHaveBeenLastCalledWith(3);
    expect(list).toHaveAttribute("aria-activedescendant", expect.stringContaining("-3"));
  });
});

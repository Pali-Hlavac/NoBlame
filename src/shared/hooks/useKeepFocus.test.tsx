import { act, render, screen } from "@testing-library/react";
import { useRef } from "react";

import { useKeepFocus } from "./useKeepFocus";

// A focusable container like the app's lists; a group, so it needs no option children here.
function List({ rows }: { rows: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const keep = useKeepFocus(ref);
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- the list takes the focus
    <div ref={ref} role="group" aria-label="Files" tabIndex={0} {...keep}>
      {rows.map((row) => (
        <button key={row} type="button">
          {row}
        </button>
      ))}
    </div>
  );
}

describe("useKeepFocus", () => {
  it("takes the focus back when the focused row goes away", async () => {
    const { rerender } = render(<List rows={["a", "b"]} />);
    act(() => {
      screen.getByRole("button", { name: "b" }).focus();
    });
    rerender(<List rows={["a"]} />);
    await act(() => Promise.resolve());
    rerender(<List rows={["a"]} />);
    expect(screen.getByRole("group", { name: "Files" })).toHaveFocus();
  });

  it("lets the focus go when it moves elsewhere", () => {
    const { rerender } = render(
      <>
        <List rows={["a"]} />
        <input aria-label="Other" />
      </>,
    );
    act(() => {
      screen.getByRole("button", { name: "a" }).focus();
    });
    act(() => {
      screen.getByRole("textbox", { name: "Other" }).focus();
    });
    rerender(
      <>
        <List rows={[]} />
        <input aria-label="Other" />
      </>,
    );
    expect(screen.getByRole("textbox", { name: "Other" })).toHaveFocus();
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";

import { CompareHint } from "./CompareHint";

const SELECTED = { index: 1, id: "1a2b3c4d5e6f", summary: "Fix the parser" };

/** A list of three rows (the first a working tree row) with the hint over it. */
function List() {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref}>
      {[0, 1, 2].map((index) => (
        <div key={index} data-index={index}>
          row {index}
        </div>
      ))}
      <CompareHint target={ref} selected={SELECTED} isCommit={(index) => index > 0} />
    </div>
  );
}

const hint = () => screen.queryByText(/Click to compare with/);

describe("CompareHint", () => {
  it("shows the selected commit while Ctrl is held over another commit", () => {
    render(<List />);
    fireEvent.mouseMove(screen.getByText("row 2"), { ctrlKey: true, clientX: 5, clientY: 5 });
    expect(hint()).toHaveTextContent(/Click to compare with 1a2b3c4 ?.*Fix the parser/);
    fireEvent.keyUp(window, { key: "Control", ctrlKey: false });
    expect(hint()).toBeNull();
  });

  it("appears when Ctrl is pressed with the pointer already on a row", () => {
    render(<List />);
    fireEvent.mouseMove(screen.getByText("row 2"), { clientX: 5, clientY: 5 });
    expect(hint()).toBeNull();
    fireEvent.keyDown(window, { key: "Control", ctrlKey: true });
    expect(hint()).not.toBeNull();
  });

  it("stays hidden over the selected commit and over working tree rows", () => {
    render(<List />);
    fireEvent.mouseMove(screen.getByText("row 1"), { ctrlKey: true });
    expect(hint()).toBeNull();
    fireEvent.mouseMove(screen.getByText("row 0"), { ctrlKey: true });
    expect(hint()).toBeNull();
  });
});

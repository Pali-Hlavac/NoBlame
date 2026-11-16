import { render, screen } from "@testing-library/react";

import { SuperprojectBadge } from "./SuperprojectBadge";

describe("SuperprojectBadge", () => {
  it("names the superproject's branches recording the commit", () => {
    render(<SuperprojectBadge label={{ superproject: "app", branches: ["main", "release"] }} />);
    const badge = screen.getByText("app: main, release").parentElement;
    expect(badge).toHaveAttribute("title", "In app, main, release record this commit");
  });
});

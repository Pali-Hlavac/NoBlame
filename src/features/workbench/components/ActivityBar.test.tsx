import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ArchiveIcon, FileIcon, FolderIcon, GitBranchIcon } from "lucide-react";

import { TooltipProvider } from "@/shared/ui/tooltip";

import { DEFAULT_ACTIVITY_BAR } from "../lib/activityBar";
import { docks, keepLayout } from "../lib/docks";
import { useWorkbenchStore } from "../store/workbench";
import type { WorkbenchModule } from "../types";
import { ActivityBar } from "./ActivityBar";

const MODULES: WorkbenchModule[] = [
  { id: "repositories", title: "Repositories", icon: FolderIcon, component: () => null },
  { id: "branches", title: "Branches", icon: GitBranchIcon, component: () => null },
  { id: "details", title: "Details", icon: FileIcon, component: () => null },
  { id: "stashes", title: "Stashes", icon: ArchiveIcon, component: () => null },
];

/** A stand-in for the browser's DataTransfer (jsdom has none). */
function dataTransfer() {
  const data = new Map<string, string>();
  return {
    get types() {
      return [...data.keys()];
    },
    setData: (type: string, value: string) => data.set(type, value),
    getData: (type: string) => data.get(type) ?? "",
    effectAllowed: "all",
    dropEffect: "none",
  };
}

function renderBar() {
  render(
    <TooltipProvider>
      <ActivityBar modules={MODULES} />
    </TooltipProvider>,
  );
  return screen.getByRole("navigation", { name: "Modules" });
}

const labels = (bar: HTMLElement) =>
  within(bar)
    .getAllByRole("button")
    .map((button) => button.getAttribute("aria-label"));

describe("ActivityBar", () => {
  beforeEach(() => {
    keepLayout(false);
    docks.registered = MODULES;
    useWorkbenchStore.setState({
      stacks: [],
      activityBar: DEFAULT_ACTIVITY_BAR,
      visibleModules: [],
      sidebarCollapsed: false,
    });
  });

  it("frames stacked modules together where the first one is", () => {
    useWorkbenchStore.setState({ stacks: [{ modules: ["stashes", "branches"], sizes: null }] });
    const bar = renderBar();
    expect(labels(bar)).toEqual(["Repositories", "Stashes", "Branches", "Details"]);
  });

  it("hides an icon under … from its menu, and shows it again", async () => {
    const user = userEvent.setup();
    const bar = renderBar();
    fireEvent.contextMenu(within(bar).getByRole("button", { name: "Branches" }));
    await user.click(await screen.findByRole("menuitem", { name: "Hide (under …)" }));
    expect(labels(bar)).toEqual(["Repositories", "Details", "Stashes", "More modules"]);
    await user.click(within(bar).getByRole("button", { name: "More modules" }));
    expect(await screen.findByRole("menuitem", { name: "Branches" })).toBeVisible();
    expect(useWorkbenchStore.getState().activityBar.hidden).toEqual(["branches"]);
  });

  it("moves an icon dropped on another one's upper half before it", () => {
    const bar = renderBar();
    const transfer = dataTransfer();
    const source = within(bar).getByRole("button", { name: "Stashes" }).parentElement;
    const target = within(bar).getByRole("button", { name: "Branches" }).parentElement;
    if (!source || !target) throw new Error("no icon wrappers");
    fireEvent.dragStart(source, { dataTransfer: transfer });
    // jsdom has no layout and drops no coordinates: every drop lands on the upper half.
    fireEvent.dragOver(target, { dataTransfer: transfer });
    fireEvent.drop(target, { dataTransfer: transfer });
    expect(labels(bar)).toEqual(["Repositories", "Stashes", "Branches", "Details"]);
  });

  it("keeps the order while locked", async () => {
    const user = userEvent.setup();
    const bar = renderBar();
    fireEvent.contextMenu(bar);
    await user.click(await screen.findByRole("menuitemcheckbox", { name: "Lock the icons" }));
    expect(useWorkbenchStore.getState().activityBar.locked).toBe(true);
    const icon = within(bar).getByRole("button", { name: "Stashes" }).parentElement;
    expect(icon).toHaveAttribute("draggable", "false");
    fireEvent.contextMenu(within(bar).getByRole("button", { name: "Stashes" }));
    expect(await screen.findByRole("menuitem", { name: "Move up" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});

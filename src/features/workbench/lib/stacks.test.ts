import { FileIcon } from "lucide-react";

import type { WorkbenchModule } from "../types";
import { barUnits, gatherStack, moveIds, stepUnit } from "./activityBar";
import {
  idsOfStackPanel,
  joinStacks,
  modulesOfPanel,
  panelIdOf,
  stackPanelId,
  withoutModule,
  withoutStack,
} from "./stacks";

const module = (id: string): WorkbenchModule => ({
  id,
  title: id,
  icon: FileIcon,
  component: () => null,
});
const MODULES = ["a", "b", "c", "d", "e"].map(module);

describe("module stacks", () => {
  it("joins a module below another, and below a stack", () => {
    const first = joinStacks([], "a", "c");
    expect(first.stack.modules).toEqual(["a", "c"]);
    const second = joinStacks(first.stacks, "c", "e");
    expect(second.stacks).toEqual([{ modules: ["a", "c", "e"], sizes: null }]);
  });

  it("takes a module out, ending a stack left with one", () => {
    const stacks = [{ modules: ["a", "b", "c"], sizes: [30, 30, 40] }];
    expect(withoutModule(stacks, "b")).toEqual([{ modules: ["a", "c"], sizes: null }]);
    expect(withoutModule(withoutModule(stacks, "b"), "a")).toEqual([]);
    expect(withoutStack(stacks, "c")).toEqual([]);
  });

  it("names a stack's panel after its modules", () => {
    const stacks = [{ modules: ["a", "b"], sizes: null }];
    expect(panelIdOf(stacks, "b")).toBe("stack:a+b");
    expect(panelIdOf(stacks, "c")).toBe("c");
    expect(modulesOfPanel(stacks, "stack:a+b")).toEqual(["a", "b"]);
    expect(modulesOfPanel(stacks, "stack:a+c")).toEqual([]);
    expect(idsOfStackPanel(stackPanelId(["a", "c"]))).toEqual(["a", "c"]);
  });
});

describe("activity bar order", () => {
  it("puts a stack where its first module is, and new modules last", () => {
    const units = barUnits(MODULES, ["d", "a"], [{ modules: ["b", "a"], sizes: null }]);
    expect(units.map((unit) => unit.modules.map((m) => m.id))).toEqual([
      ["d"],
      ["b", "a"],
      ["c"],
      ["e"],
    ]);
  });

  it("moves ids together before or after a target", () => {
    expect(moveIds(["a", "b", "c", "d"], ["a", "b"], ["d"], true)).toEqual(["c", "d", "a", "b"]);
    expect(moveIds(["a", "b", "c", "d"], ["d"], ["b", "c"], false)).toEqual(["a", "d", "b", "c"]);
    expect(gatherStack(["a", "b", "c", "d"], ["a", "d"])).toEqual(["a", "d", "b", "c"]);
  });

  it("steps a unit past its neighbour", () => {
    const stacks = [{ modules: ["b", "c"], sizes: null }];
    const units = barUnits(MODULES, [], stacks);
    const [, stack] = units;
    if (!stack) throw new Error("no stack unit");
    expect(stepUnit(units, ["a", "b", "c", "d", "e"], stack, 1)).toEqual(["a", "d", "b", "c", "e"]);
    expect(stepUnit(units, ["a", "b", "c", "d", "e"], stack, -1)).toEqual([
      "b",
      "c",
      "a",
      "d",
      "e",
    ]);
  });
});

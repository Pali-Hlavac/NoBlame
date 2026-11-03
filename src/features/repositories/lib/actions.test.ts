import { FolderOpenIcon, XIcon } from "lucide-react";

import { actionsFor, type RepositoryAction, type RepositoryTarget } from "./actions";

const ACTIONS: RepositoryAction[] = [
  { id: "open", label: "Open", icon: FolderOpenIcon, when: "closed" },
  { id: "close", label: "Close", icon: XIcon, when: "open" },
  { id: "copy", label: "Copy path", icon: XIcon },
];

const target = (open: boolean): RepositoryTarget => ({ path: "/r", tabId: "t", title: "r", open });

describe("repository actions", () => {
  it("offers Open on closed repositories and Close on open ones", () => {
    expect(actionsFor(ACTIONS, target(false)).map((action) => action.id)).toEqual(["open", "copy"]);
    expect(actionsFor(ACTIONS, target(true)).map((action) => action.id)).toEqual(["close", "copy"]);
  });
});

import { installNativeFeel } from "./native-feel";

function dispatch(target: EventTarget, event: Event): boolean {
  target.dispatchEvent(event);
  return event.defaultPrevented;
}

const key = (key: string, extra: KeyboardEventInit = {}) =>
  new KeyboardEvent("keydown", { key, ctrlKey: true, cancelable: true, ...extra });
const contextMenu = () => new MouseEvent("contextmenu", { bubbles: true, cancelable: true });

describe("installNativeFeel in production", () => {
  let uninstall: () => void;
  beforeAll(() => {
    uninstall = installNativeFeel();
  });
  afterAll(() => {
    uninstall();
  });

  it("blocks the context menu on regular elements", () => {
    const div = document.body.appendChild(document.createElement("div"));
    expect(dispatch(div, contextMenu())).toBe(true);
  });

  it("keeps the context menu on inputs", () => {
    const input = document.body.appendChild(document.createElement("input"));
    expect(dispatch(input, contextMenu())).toBe(false);
  });

  it("blocks reload and print but not ordinary shortcuts", () => {
    expect(dispatch(window, key("r"))).toBe(true);
    expect(dispatch(window, key("p"))).toBe(true);
    expect(dispatch(window, key("P", { shiftKey: true }))).toBe(true);
    expect(dispatch(window, key("c"))).toBe(false);
  });
});

describe("installNativeFeel in development", () => {
  let uninstall: () => void;
  beforeAll(() => {
    uninstall = installNativeFeel({ development: true });
  });
  afterAll(() => {
    uninstall();
  });

  it("blocks print only, keeping reload and the context menu", () => {
    expect(dispatch(window, key("p"))).toBe(true);
    expect(dispatch(window, key("r"))).toBe(false);
    const div = document.body.appendChild(document.createElement("div"));
    expect(dispatch(div, contextMenu())).toBe(false);
  });
});

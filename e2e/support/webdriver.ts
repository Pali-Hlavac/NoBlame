/**
 * A minimal W3C WebDriver client for tauri-driver (ADR 0016): start the app, run scripts in its
 * page, type, press keys. Checks read the page with scripts and the repository with git, so few
 * commands are needed and no client library.
 */
import { spawn, type ChildProcess } from "node:child_process";

const DRIVER_URL = "http://127.0.0.1:4444";
const POLL_MS = 200;
const DRIVER_START_MS = 15_000;
const WAIT_MS = 30_000;

/** The key WebDriver sends for a modifier or special key. */
export const KEY = {
  control: "",
  shift: "",
  alt: "",
  enter: "",
  escape: "",
} as const;

interface WebDriverReply {
  value: unknown;
}

async function call(method: string, path: string, body?: unknown): Promise<unknown> {
  const response = await fetch(`${DRIVER_URL}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const reply = (await response.json()) as WebDriverReply;
  if (!response.ok) throw new Error(`${method} ${path}: ${JSON.stringify(reply.value)}`);
  return reply.value;
}

/** Waits until `check` returns something other than null, undefined or false. */
export async function waitFor<T>(
  what: string,
  check: () => Promise<T | null | undefined | false> | T | null | undefined | false,
  timeoutMs = WAIT_MS,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last = "";
  while (Date.now() < deadline) {
    try {
      const value = await check();
      if (value !== null && value !== undefined && value !== false) return value;
    } catch (error) {
      last = error instanceof Error ? error.message : JSON.stringify(error);
    }
    await new Promise((done) => setTimeout(done, POLL_MS));
  }
  throw new Error(`Timed out waiting for ${what}${last ? `: ${last}` : ""}`);
}

/** Runs tauri-driver (and through it the platform's WebDriver) until `stop`. */
export async function startDriver(): Promise<ChildProcess> {
  const binary = process.env.NOBLAME_E2E_TAURI_DRIVER;
  if (!binary) throw new Error("Run the end-to-end tests with `pnpm e2e`.");
  const native = process.env.NOBLAME_E2E_NATIVE_DRIVER;
  const driver = spawn(binary, native ? ["--native-driver", native] : [], { stdio: "inherit" });
  await waitFor(
    "tauri-driver",
    async () => (await fetch(`${DRIVER_URL}/status`)).ok,
    DRIVER_START_MS,
  );
  return driver;
}

/** One running app, driven through its first window. */
export class App {
  private constructor(private readonly session: string) {}

  /**
   * Starts the app without arguments: the Edge WebDriver passes them on as browser switches
   * (`--c:\repo`), which the command line refuses. Open what a test needs with
   * {@link App.invoke}, as the command line and **Open in NoBlame** do.
   */
  static async start(): Promise<App> {
    const application = process.env.NOBLAME_E2E_APP;
    if (!application) throw new Error("Run the end-to-end tests with `pnpm e2e`.");
    const value = (await call("POST", "/session", {
      capabilities: { alwaysMatch: { "tauri:options": { application } } },
    })) as { sessionId: string };
    const app = new App(value.sessionId);
    await waitFor("the app's page", () =>
      app.run<boolean>(`return "__TAURI_INTERNALS__" in window;`),
    );
    return app;
  }

  /** Calls a Tauri command from the page (`open_in_main_window`, `open_task_window`). */
  async invoke(command: string, args: Record<string, unknown>): Promise<unknown> {
    return this.run(
      `return window.__TAURI_INTERNALS__.invoke(arguments[0], arguments[1]);`,
      command,
      args,
    );
  }

  /**
   * Drives the window that is not among `known` (a task window that just opened). WebDriver
   * lists handles in no promised order: WebKitWebDriver (Linux) does not put the newest last.
   */
  async switchToNewWindow(known: readonly string[]): Promise<void> {
    const handle = await waitFor("a new window", async () =>
      (await this.windowHandles()).find((candidate) => !known.includes(candidate)),
    );
    await call("POST", `/session/${this.session}/window`, { handle });
  }

  /** The handles of the app's windows. */
  async windowHandles(): Promise<string[]> {
    return (await call("GET", `/session/${this.session}/window/handles`)) as string[];
  }

  /** Runs `script` (a function body; `arguments` holds `args`) in the page. */
  async run<T>(script: string, ...args: unknown[]): Promise<T> {
    return (await call("POST", `/session/${this.session}/execute/sync`, { script, args })) as T;
  }

  /** Types `text` into what has the keyboard (special keys from {@link KEY} allowed). */
  async type(text: string): Promise<void> {
    // Each UTF-16 unit is one key: the tests type plain text and WebDriver's special keys.
    const actions = text.split("").flatMap((key) => [
      { type: "keyDown", value: key },
      { type: "keyUp", value: key },
    ]);
    await this.actions(actions);
  }

  /** Presses `key` with the modifiers held (`press(KEY.control, KEY.shift, "n")`). */
  async press(...keys: string[]): Promise<void> {
    const down = keys.map((key) => ({ type: "keyDown", value: key }));
    const up = [...keys].reverse().map((key) => ({ type: "keyUp", value: key }));
    await this.actions([...down, ...up]);
  }

  private async actions(actions: unknown[]): Promise<void> {
    await call("POST", `/session/${this.session}/actions`, {
      actions: [{ type: "key", id: "keyboard", actions }],
    });
    await call("DELETE", `/session/${this.session}/actions`);
  }

  /** Clicks the visible button whose text, label or tooltip is `name` (the first one). */
  async clickButton(name: string): Promise<void> {
    await waitFor(`the button “${name}”`, () =>
      this.run<boolean>(
        `const name = arguments[0];
         const button = [...document.querySelectorAll("button")].find((b) =>
           !b.disabled && b.getClientRects().length > 0 &&
           (b.getAttribute("aria-label") === name || b.textContent.trim() === name ||
            b.title === name));
         if (!button) return false;
         button.click();
         return true;`,
        name,
      ),
    );
  }

  /**
   * Focuses the field labelled or with the placeholder `label`. While it cannot, the page says
   * why (the window's title, the fields it has), which a timeout then reports.
   */
  async focusField(label: string): Promise<void> {
    await waitFor(`the field “${label}”`, () =>
      this.run<boolean>(
        `const label = arguments[0];
         const fields = [...document.querySelectorAll("input, textarea")];
         const field = fields.find((f) => f.placeholder === label ||
           f.getAttribute("aria-label") === label ||
           (f.labels && [...f.labels].some((l) => l.textContent.trim() === label)));
         const names = fields.map((f) => f.placeholder || f.getAttribute("aria-label") || f.name);
         if (!field) throw new Error("not in " + document.title + ", which has " + JSON.stringify(names));
         field.focus();
         if (document.activeElement !== field) throw new Error("found in " + document.title + " but it did not take the focus");
         return true;`,
        label,
      ),
    );
  }

  /** The text of the rows the commit graph shows. */
  async graphRows(): Promise<string[]> {
    return this.run<string[]>(
      `return [...document.querySelectorAll('[role="listbox"] [role="option"][data-index]')]
         .map((row) => row.textContent);`,
    );
  }

  /** Closes the app. */
  async quit(): Promise<void> {
    await call("DELETE", `/session/${this.session}`);
  }
}

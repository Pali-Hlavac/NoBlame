import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { CommitDefaultsDto } from "@/shared/ipc/bindings";

import { useDraftStore } from "../store/draft";
import { readCommitLayout, useCommitLayout } from "../store/layout";
import { CommitMessage } from "./CommitMessage";

const ipc = vi.hoisted(() => ({
  getStatus: vi.fn(),
  createCommit: vi.fn(),
  getHeadMessage: vi.fn(),
  getCommitDefaults: vi.fn(),
  getRecentMessages: vi.fn(),
}));
vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc }));

const TEMPLATE = "Summary\n\n# Why is it needed?\n";
const DEFAULTS: CommitDefaultsDto = {
  author: "Ada Lovelace <ada@example.com>",
  template: null,
  commentChar: "#",
};

function renderMessage(defaults: CommitDefaultsDto = DEFAULTS) {
  ipc.getCommitDefaults.mockResolvedValue({ status: "ok", data: defaults });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <CommitMessage repoId={1} repoPath="/repo" />
    </QueryClientProvider>,
  );
}

function messageBox(): HTMLTextAreaElement {
  return screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Commit message" });
}

describe("CommitMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDraftStore.setState({ drafts: {} });
    useCommitLayout.setState({ folded: false });
    ipc.getStatus.mockResolvedValue({
      status: "ok",
      data: { summary: { staged: 1, unstaged: 0, untracked: 0, conflicted: 0 } },
    });
    ipc.createCommit.mockResolvedValue({ status: "ok", data: { output: "[main abc] Done" } });
  });

  it("starts from the template and leaves its comments out", async () => {
    renderMessage({
      ...DEFAULTS,
      template: { path: ".gitmessage", text: TEMPLATE, problem: null },
    });
    await waitFor(() => {
      expect(messageBox().value).toBe("Summary\n\n# Why is it needed?");
    });
    expect(screen.getByText("Fill in the template first.")).toBeVisible();
    expect(screen.getByText(/lines starting with # are left out/)).toBeVisible();

    fireEvent.change(messageBox(), { target: { value: "Fix it\n\n# Why is it needed?" } });
    fireEvent.click(screen.getByRole("button", { name: "Commit" }));
    await waitFor(() => {
      expect(ipc.createCommit).toHaveBeenCalledWith(1, {
        message: "Fix it\n\n# Why is it needed?",
        amend: false,
        signOff: false,
        author: null,
        stripComments: true,
      });
    });
    // After the commit the template is back for the next one.
    await waitFor(() => {
      expect(messageBox().value).toBe("Summary\n\n# Why is it needed?");
    });
  });

  it("replaces the message with a recent one", async () => {
    const user = userEvent.setup();
    ipc.getRecentMessages.mockResolvedValue({
      status: "ok",
      data: ["Fix typo", "Add the parser\n\nWith tests"],
    });
    renderMessage();
    fireEvent.change(messageBox(), { target: { value: "Draft" } });
    await user.click(screen.getByRole("button", { name: "Recent" }));
    await user.click(await screen.findByRole("menuitem", { name: "Add the parser" }));
    expect(messageBox().value).toBe("Add the parser\n\nWith tests");
    expect(ipc.getRecentMessages).toHaveBeenCalledWith(1);
  });

  it("commits as someone else once the author reads Name <email>", async () => {
    renderMessage();
    const change = await screen.findByRole("button", { name: "Change the author" });
    await waitFor(() => {
      expect(change.title).toContain("Author: Ada Lovelace <ada@example.com>.");
    });
    fireEvent.change(messageBox(), { target: { value: "Apply the patch" } });
    fireEvent.click(change);
    const author = screen.getByRole("textbox", { name: "Author" });
    fireEvent.change(author, { target: { value: "Grace Hopper" } });
    expect(screen.getByText("Write it as Name <email>.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Commit" })).toBeDisabled();

    fireEvent.change(author, { target: { value: " Grace Hopper <grace@example.com>" } });
    fireEvent.click(screen.getByRole("button", { name: "Commit" }));
    await waitFor(() => {
      expect(ipc.createCommit).toHaveBeenCalledWith(1, {
        message: "Apply the patch",
        amend: false,
        signOff: false,
        author: "Grace Hopper <grace@example.com>",
        stripComments: false,
      });
    });
    // The override is for one commit.
    expect(await screen.findByRole("button", { name: "Change the author" })).toBeVisible();
    expect(screen.queryByRole("textbox", { name: "Author" })).toBeNull();
  });

  it("measures the summary and warns about a second line", () => {
    renderMessage();
    fireEvent.change(messageBox(), { target: { value: `${"x".repeat(60)}\nmore` } });
    expect(screen.getByText("Leave line 2 empty")).toBeVisible();
    expect(screen.getByText(/60\/50/)).toHaveClass("text-warning");
  });

  it("folds to the summary and the Commit button, and back", async () => {
    const user = userEvent.setup();
    renderMessage();
    fireEvent.change(messageBox(), { target: { value: "Fold me\n\nBody" } });
    await user.click(screen.getByRole("button", { name: "Fold the message to one line" }));
    expect(screen.queryByRole("textbox", { name: "Commit message" })).toBeNull();
    expect(screen.getByText("Fold me")).toBeVisible();
    expect(screen.getByRole("button", { name: "Commit" })).toBeVisible();
    expect(readCommitLayout().folded).toBe(true);
    await user.click(screen.getByRole("button", { name: "Show the whole message" }));
    expect(messageBox().value).toBe("Fold me\n\nBody");
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { CredentialRequestDto } from "@/shared/ipc/bindings";

import { CredentialPrompt } from "./CredentialPrompt";

const ipc = vi.hoisted(() => ({
  listCredentialRequests: vi.fn(),
  answerCredential: vi.fn(),
}));

vi.mock("@/shared/ipc/bindings", () => ({
  commands: ipc,
  events: {
    credentialRequested: { listen: () => Promise.resolve(() => undefined) },
    credentialClosed: { listen: () => Promise.resolve(() => undefined) },
  },
}));

function request(overrides: Partial<CredentialRequestDto> = {}): CredentialRequestDto {
  return {
    id: 4,
    jobId: 2,
    jobTitle: "Fetch origin",
    repoPath: "C:\\code\\app",
    prompt: "Password for 'https://ada@example.com':",
    kind: "password",
    secret: true,
    ...overrides,
  };
}

function renderPrompt() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <CredentialPrompt />
    </QueryClientProvider>,
  );
}

describe("CredentialPrompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ipc.answerCredential.mockResolvedValue(true);
  });

  it("asks for a password without showing it and passes the answer on", async () => {
    const user = userEvent.setup();
    ipc.listCredentialRequests.mockResolvedValue([request()]);
    renderPrompt();
    const field = await screen.findByLabelText("Password or token");
    expect(field).toHaveAttribute("type", "password");
    expect(screen.getByText(/Fetch origin in app/)).toBeVisible();
    expect(screen.getByText("Password for 'https://ada@example.com':")).toBeVisible();
    await user.type(field, "s3cret{enter}");
    expect(ipc.answerCredential).toHaveBeenCalledWith(4, "s3cret");
  });

  it("shows a user name as typed and cancels with Escape", async () => {
    const user = userEvent.setup();
    ipc.listCredentialRequests.mockResolvedValue([
      request({ kind: "username", secret: false, prompt: "Username for 'https://x':" }),
    ]);
    renderPrompt();
    expect(await screen.findByLabelText("User name")).toHaveAttribute("type", "text");
    await user.keyboard("{Escape}");
    expect(ipc.answerCredential).toHaveBeenCalledWith(4, null);
  });

  it("answers an unknown host key with yes only when trusted", async () => {
    const user = userEvent.setup();
    ipc.listCredentialRequests.mockResolvedValue([
      request({
        kind: "hostKey",
        secret: false,
        prompt: "ED25519 key fingerprint is SHA256:abc.\nAre you sure (yes/no/[fingerprint])?",
      }),
    ]);
    renderPrompt();
    expect(await screen.findByText(/SHA256:abc/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Trust and connect" }));
    expect(ipc.answerCredential).toHaveBeenCalledWith(4, "yes");
  });

  it("shows nothing while no prompt waits", async () => {
    ipc.listCredentialRequests.mockResolvedValue([]);
    renderPrompt();
    await Promise.resolve();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

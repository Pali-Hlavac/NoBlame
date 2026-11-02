import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { CommitDetailsDto, SignatureCheckDto } from "@/shared/ipc/bindings";

import { CommitDetailsView } from "./CommitDetailsView";

const ipc = vi.hoisted(() => ({ verifyCommitSignature: vi.fn() }));
vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc }));

const selection = vi.hoisted(() => ({ selectRow: vi.fn() }));
vi.mock("@/features/selection", () => selection);

const person = { name: "Ada", email: "ada@example.com", time: 1_600_000_000, offsetMinutes: 0 };

const DETAILS: CommitDetailsDto = {
  row: 5,
  id: "a".repeat(40),
  parents: [{ id: "b".repeat(40), row: 6 }],
  children: [
    { id: "c".repeat(40), row: 2 },
    { id: "d".repeat(40), row: null },
  ],
  author: person,
  committer: person,
  message: "Fix the thing",
  signature: null,
  refs: [],
  containedIn: [],
  containedInTotal: 0,
};

const GOOD: SignatureCheckDto = {
  format: "ssh",
  verdict: "good",
  signer: "ada@example.com",
  key: "SHA256:abc",
  fingerprint: "SHA256:abc",
  primaryFingerprint: null,
  trust: null,
  message: 'Good "git" signature for ada@example.com',
};

function renderView(details: CommitDetailsDto) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <CommitDetailsView details={details} repoId={1} repoPath="/r/app" />
    </QueryClientProvider>,
  );
}

describe("CommitDetailsView", () => {
  beforeEach(() => {
    ipc.verifyCommitSignature.mockReset();
    selection.selectRow.mockReset();
  });

  it("lists children and selects a shown one", async () => {
    const user = userEvent.setup();
    renderView(DETAILS);
    expect(screen.getByText("Children")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "cccccccc" }));
    expect(selection.selectRow).toHaveBeenCalledWith("/r/app", 2);
    // A child the filter hides is not a button.
    expect(screen.queryByRole("button", { name: "dddddddd" })).toBeNull();
    expect(screen.getByTitle(/\(hidden by the filter\)/)).toHaveTextContent("dddddddd");
  });

  it("does not check unsigned commits", () => {
    renderView(DETAILS);
    expect(screen.queryByText("Signature")).toBeNull();
    expect(ipc.verifyCommitSignature).not.toHaveBeenCalled();
  });

  it("shows a good signature and who made it", async () => {
    ipc.verifyCommitSignature.mockResolvedValue({ status: "ok", data: GOOD });
    renderView({ ...DETAILS, signature: "ssh" });
    expect(screen.getByText(/Checking the SSH signature/)).toBeVisible();
    expect(await screen.findByText("Good signature")).toBeVisible();
    expect(screen.getByText(/signed by ada@example.com/)).toBeVisible();
    expect(ipc.verifyCommitSignature).toHaveBeenCalledWith(1, DETAILS.id);
  });

  it("says why a signature could not be checked", async () => {
    const message = "gpg: Can't check signature: No public key";
    ipc.verifyCommitSignature.mockResolvedValue({
      status: "ok",
      data: { ...GOOD, format: "openPgp", verdict: "cannotCheck", signer: null, message },
    });
    renderView({ ...DETAILS, signature: "openPgp" });
    expect(await screen.findByText(/could not be checked/)).toBeVisible();
    expect(screen.getByText(message)).toBeVisible();
  });
});

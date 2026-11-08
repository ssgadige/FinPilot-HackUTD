import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/components/auth/auth-provider";
import { AgentWorkspace } from "@/components/chat/agent-workspace";
import { planningAccounts } from "../fixtures/planning";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it("hands specialist evidence to a reviewable coach draft, preserves discussion across views and clears on identity change", async () => {
  let userId = "user-a";
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "X-CSRF-Token": "fixture-csrf" } });
  const fetcher = vi.fn(async (path: string) => {
    if (path === "/api/v1/me") return json({ id: userId, display_name: "Test person", email: "person@example.test" });
    if (path === "/api/v1/accounts") return json(planningAccounts);
    if (path === "/api/v1/runs/owned") return json({ run_id: "owned", status: "completed", snapshot_version: planningAccounts.snapshot_version, stale: false, role_steps: [], findings: [{ id: "finding-a", severity: "warning", summary: "Review the supported cash finding.", evidence_ids: ["calc-owned"] }], inference_source_mode: "cached" });
    if (path.startsWith("/api/v1/runs/owned/events")) return json({ items: [], next_cursor: "0", has_more: false, stale: false });
    if (path === "/api/v1/chat") return json({ reply: "Current evidence explanation.", evidence_ids: ["calc-owned"], requested_run_id: null, conversation_id: "conversation-a", source_mode: "fixture", inference_source_mode: "cached" });
    return json({}, 404);
  });
  vi.stubGlobal("fetch", fetcher);
  function Switch() { const auth = useAuth(); return <button onClick={() => void auth.refresh()}>Switch test user</button>; }
  render(<AuthProvider><Switch /><AgentWorkspace /></AuthProvider>);
  const user = userEvent.setup();
  await screen.findByLabelText("Existing authorized run ID");
  await user.type(screen.getByLabelText("Existing authorized run ID"), "owned");
  await user.click(screen.getByRole("button", { name: "Inspect run availability" }));
  await user.click(await screen.findByRole("button", { name: "Explain finding" }));
  const input = screen.getByLabelText("Ask FinPilot");
  expect(input).toHaveValue("Explain the current finding supported by evidence calc-owned.");
  expect(fetcher.mock.calls.filter(([p]) => p === "/api/v1/chat")).toHaveLength(0);
  await user.click(screen.getByRole("button", { name: "Send message" }));
  await screen.findByText("Current evidence explanation.");
  await user.click(screen.getByRole("button", { name: "Specialist team" }));
  expect(screen.queryByRole("log", { name: "Conversation" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Ask FinPilot" }));
  expect(screen.getByText("Current evidence explanation.")).toBeVisible();
  userId = "user-b";
  fireEvent.click(screen.getByRole("button", { name: "Switch test user" }));
  await waitFor(() => expect(screen.queryByText("Current evidence explanation.")).not.toBeInTheDocument());
  await user.click(screen.getByRole("button", { name: "Ask FinPilot" }));
  expect(screen.getByLabelText("Ask FinPilot")).toHaveValue("");
});

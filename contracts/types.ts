// Contract v1. Server injects user identity; clients/models never choose it.
export type Cents = number; // integer, USD only for this prototype
export type SpecialistId = 'data-integrity' | 'cash-collision' | 'subscription-detective' | 'deal-scout' | 'debt-readiness' | 'goal-allocator' | 'stress-test' | 'plan-repair';
export type RoleId = SpecialistId | 'coordinator' | 'chat';
export type SourceMode = 'live' | 'fixture' | 'cached';
export interface Evidence { id: string; kind: 'transaction' | 'account' | 'calculation' | 'offer'; source_id: string; source_mode: SourceMode; observed_at: string; }
export interface Finding { id: string; severity: 'info' | 'opportunity' | 'warning' | 'urgent'; summary: string; evidence_ids: string[]; amount_cents: Cents | null; }
export interface ProposedAction { id: string; type: 'save_plan' | 'review_subscription' | 'adjust_goal' | 'review_payment'; description: string; requires_confirmation: true; }
export interface AgentResult { agent_id: RoleId; status: 'completed' | 'needs_information' | 'failed' | 'skipped'; headline: string; findings: Finding[]; evidence_ids: string[]; assumptions: string[]; missing_data: string[]; proposed_actions: ProposedAction[]; snapshot_version: number; selected_specialists?: SpecialistId[]; }
export interface ToolContext { userId: string; snapshotVersion: number; allowedAccountIds: string[]; runId: string; } // server-only
export interface RunEvent { id: string; run_id: string; agent_id: RoleId; type: 'queued' | 'started' | 'tool_started' | 'tool_completed' | 'completed' | 'failed' | 'skipped'; at: string; message: string; }
export interface ApiError { error: { code: string; message: string; request_id: string; }; }
export interface Page<T> { items: T[]; next_cursor: string | null; }
// FP-04/FP-12 accounts agreement. The snapshot belongs to the authenticated user,
// including when no accounts are linked; unknown sync timestamps are omitted.
export interface AccountSummary {
  id: string;
  institution_id?: string;
  kind: 'checking' | 'savings' | 'credit_card' | 'brokerage' | 'ira' | 'cd' | 'auto_loan' | 'mortgage';
  label: string;
  last_four?: string;
  balance_cents?: Cents | null;
  source_mode?: SourceMode;
  last_sync_at?: string;
  maturity_date?: string | null;
}
export interface AccountsResponse {
  items: AccountSummary[];
  snapshot_version: number;
  source_mode: SourceMode;
  as_of: string;
}
export interface Offer { id: string; provider: string; plan: string; source_url: string | null; source_mode: SourceMode; verified_at: string | null; monthly_equivalent_cents: Cents; upfront_cents: Cents; eligibility: string[]; features: string[]; promo_end: string | null; renewal_cents: Cents | null; currency: 'USD'; }

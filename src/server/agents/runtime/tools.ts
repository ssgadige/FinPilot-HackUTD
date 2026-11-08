import { createHash } from 'node:crypto';
import type { ToolContext, Evidence, SourceMode } from '../../../../contracts/types.ts';
import type { Tool } from '../../nemotron/index.ts';
export type Context = Readonly<Omit<ToolContext, 'allowedAccountIds'> & { allowedAccountIds: readonly string[] }>;
export interface Snapshot {
  userId: string; version: number; asOf: string; sourceMode: SourceMode;
  accounts: { id: string; userId: string; connected: boolean; kind: string; openingCents: number; balanceCents: number; syncedAt: string }[];
  transactions: { id: string; userId: string; accountId: string; date: string; deltaCents: number; transferGroup?: string }[];
  scheduled: { id: string; userId: string; accountId: string; date: string; deltaCents: number }[];
}
export interface ToolOutput { data: unknown; evidence: Evidence[]; assumptions: string[]; }
export interface BoundTool {
  schema: Tool;
  execute(args: Record<string, unknown>, context: Context, signal: AbortSignal): Promise<ToolOutput>;
}
export const allowlists = {
  'data-integrity': ['get_connection_status', 'reconcile_ledger', 'find_transfer_pairs'],
  'cash-collision': ['get_cash_calendar', 'forecast_cash', 'compare_cash_scenarios'],
} as const;
export type Role = keyof typeof allowlists;
export type SnapshotLoader = (context: Context, signal: AbortSignal) => Promise<Snapshot>;
const liabilities = new Set(['credit_card', 'auto_loan', 'mortgage']);
const liquid = new Set(['checking', 'savings', 'wallet']);
function date(s: string) { return /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(s).toISOString().slice(0, 10) === s; }
function sum(values: number[]) {
  return values.reduce((a, b) => {
    const n = a + b; if (!Number.isSafeInteger(n)) throw new Error('INVALID_CENTS'); return n;
  }, 0);
}
export function createTools(load: SnapshotLoader): Record<string, BoundTool> {
  return Object.fromEntries(Object.values(allowlists).flat().map(name => [name, {
    schema: { type: 'function', function: { name, description: `${name}: authorized snapshot analysis. Returns deterministic cents, dates, evidence and assumptions. Use scope="snapshot". Identity is injected by the server.`,
      parameters: { type: 'object', properties: { scope: { type: 'string', enum: ['snapshot'] } }, required: ['scope'], additionalProperties: false } } },
    async execute(args: Record<string, unknown>, ctx: Context, signal: AbortSignal) {
      signal.throwIfAborted();
      if (args.scope !== 'snapshot' || Object.keys(args).length !== 1) throw new Error('INVALID_TOOL_ARGUMENTS');
      // Loader must recheck current consent/ownership on EVERY read, including disconnect.
      const s = structuredClone(await load(ctx, signal));
      signal.throwIfAborted();
      if (s.userId !== ctx.userId || s.version !== ctx.snapshotVersion) throw new Error('SNAPSHOT_SCOPE');
      if (!date(s.asOf) || !['fixture', 'cached', 'live'].includes(s.sourceMode)) throw new Error('INVALID_SNAPSHOT');
      if (new Set(s.accounts.map(a => a.id)).size !== s.accounts.length || s.accounts.some(a => a.userId !== ctx.userId || !a.connected || !ctx.allowedAccountIds.includes(a.id))) throw new Error('ACCOUNT_SCOPE');
      const ids = new Set(s.accounts.map(a => a.id));
      if (ctx.allowedAccountIds.some(id => !ids.has(id))) throw new Error('ACCOUNT_DISCONNECTED');
      if ([...s.transactions, ...s.scheduled].some(t => t.userId !== ctx.userId || !ids.has(t.accountId) || !date(t.date) || !Number.isSafeInteger(t.deltaCents)) || s.accounts.some(a => !Number.isSafeInteger(a.balanceCents) || !Number.isSafeInteger(a.openingCents) || !Number.isFinite(Date.parse(a.syncedAt)))) throw new Error('RECORD_SCOPE');
      const assumptions = ['Snapshot balances already include historical transactions.', 'Transfers are not income or spending.', 'Only checking, savings and wallet accounts are spendable.', 'Same-day expenses precede income conservatively.'];
      let data: unknown;
      if (name === 'get_connection_status') data = { missing_accounts: s.accounts.length === 0, stale_account_ids: s.accounts.filter(a => Date.parse(s.asOf) - Date.parse(a.syncedAt) > 7 * 86400000).map(a => a.id) };
      if (name === 'reconcile_ledger') {
        const seen = new Set<string>(); const duplicate_ids: string[] = [];
        for (const t of s.transactions) { if (seen.has(t.id)) duplicate_ids.push(t.id); seen.add(t.id); }
        data = { duplicate_transaction_ids: duplicate_ids, mismatches: s.accounts.flatMap(a => {
          const expected_cents = sum([a.openingCents, ...s.transactions.filter(t => t.accountId === a.id).map(t => t.deltaCents)]);
          return expected_cents === a.balanceCents ? [] : [{ account_id: a.id, expected_cents, actual_cents: a.balanceCents, difference_cents: sum([a.balanceCents, -expected_cents]) }];
        }) };
      }
      if (name === 'find_transfer_pairs') {
        const groups = Map.groupBy(s.transactions.filter(t => t.transferGroup), t => t.transferGroup!);
        data = { transfers: [...groups].map(([group, rows]) => {
          const normalized = rows.map(t => liabilities.has(s.accounts.find(a => a.id === t.accountId)!.kind) ? -t.deltaCents : t.deltaCents);
          return { group, matched: rows.length === 2 && rows[0].accountId !== rows[1].accountId && Math.abs(Date.parse(rows[0].date) - Date.parse(rows[1].date)) <= 3 * 86400000 && sum(normalized) === 0,
            amount_cents: Math.abs(rows[0].deltaCents), counted_as_income_or_spending: false };
        }) };
      }
      const horizon = new Date(s.asOf); horizon.setUTCDate(horizon.getUTCDate() + 30);
      const schedule = s.scheduled.filter(t => t.date > s.asOf && t.date <= horizon.toISOString().slice(0, 10) && liquid.has(s.accounts.find(a => a.id === t.accountId)!.kind));
      if (new Set(schedule.map(t => t.id)).size !== schedule.length) throw new Error('DUPLICATE_SCHEDULE');
      const forecast = (rows: typeof schedule) => {
        const balances = new Map(s.accounts.filter(a => liquid.has(a.kind)).map(a => [a.id, a.balanceCents]));
        const collisions: { date: string; account_id: string; balance_cents: number; total_cash_cents: number }[] = [];
        for (const t of [...rows].sort((a, b) => a.date.localeCompare(b.date) || a.deltaCents - b.deltaCents || a.id.localeCompare(b.id))) {
          const balance = sum([balances.get(t.accountId)!, t.deltaCents]); balances.set(t.accountId, balance);
          if (balance < 0) collisions.push({ date: t.date, account_id: t.accountId, balance_cents: balance, total_cash_cents: sum([...balances.values()]) });
        }
        return { collisions, ending_balances: Object.fromEntries(balances) };
      };
      if (name === 'get_cash_calendar') data = { as_of: s.asOf, days: 30, scheduled: schedule.map(t => ({ id: t.id, account_id: t.accountId, date: t.date, delta_cents: t.deltaCents })) };
      if (name === 'forecast_cash') data = forecast(schedule);
      if (name === 'compare_cash_scenarios') data = { baseline: forecast(schedule), delayed_income_7_days: forecast(schedule.map(t => {
        if (t.deltaCents <= 0) return t;
        const d = new Date(t.date); d.setUTCDate(d.getUTCDate() + 7); return { ...t, date: d.toISOString().slice(0, 10) };
      }).filter(t => t.date <= horizon.toISOString().slice(0, 10))), proposal_only: true };
      const id = createHash('sha256').update(JSON.stringify([ctx.userId, ctx.runId, ctx.snapshotVersion, name, data])).digest('hex').slice(0, 24);
      return { data, assumptions, evidence: [{ id: `calc-${id}`, kind: 'calculation', source_id: name, source_mode: s.sourceMode, observed_at: `${s.asOf}T00:00:00.000Z` }] };
    },
  } as BoundTool]));
}

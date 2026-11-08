// Synthetic acceptance scenario. Never label these finances as live.
import type { Snapshot } from '../../src/server/agents/runtime/tools.ts';
import type { ToolContext } from '../../contracts/types.ts';
export const context: ToolContext = { userId: 'fp18-demo', runId: 'fp18-acceptance', snapshotVersion: 1, allowedAccountIds: ['checking', 'savings', 'card'] };
export function fixture(): Snapshot {
  const account = (id: string, kind: string, openingCents: number, balanceCents: number, syncedAt = '2026-11-07T00:00:00Z') =>
    ({ id, kind, openingCents, balanceCents, syncedAt, userId: context.userId, connected: true });
  const tx = (id: string, accountId: string, deltaCents: number, transferGroup?: string) =>
    ({ id, accountId, deltaCents, transferGroup, userId: context.userId, date: '2026-11-06' });
  return { userId: context.userId, version: 1, asOf: '2026-11-07', sourceMode: 'fixture', accounts: [
    account('checking', 'checking', 100000, 50000),
    account('savings', 'savings', 200000, 230000, '2026-10-01T00:00:00Z'),
    account('card', 'credit_card', 50000, 30000),
  ], transactions: [
    tx('save-out', 'checking', -30000, 'internal-saving'), tx('save-in', 'savings', 30000, 'internal-saving'),
    tx('payment-out', 'checking', -20000, 'card-payment'), tx('payment-in', 'card', -20000, 'card-payment'),
    tx('duplicate', 'checking', -1000), tx('duplicate', 'checking', -1000),
    tx('unpaired', 'card', -5000, 'missing-transfer-leg'),
  ], scheduled: [
    { id: 'rent', userId: context.userId, accountId: 'checking', date: '2026-11-10', deltaCents: -120000 },
    { id: 'income', userId: context.userId, accountId: 'checking', date: '2026-11-15', deltaCents: 200000 },
  ] };
}

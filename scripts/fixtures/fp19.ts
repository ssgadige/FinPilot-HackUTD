import type { ToolContext } from '../../contracts/types.ts';
import type { SubscriptionSnapshot } from '../../src/server/agents/subscription-tools.ts';
export const context: ToolContext = { userId: 'fp19-demo', runId: 'fp19-acceptance', snapshotVersion: 1, allowedAccountIds: ['card'] };
export function fixture(): SubscriptionSnapshot {
  return { userId: context.userId, version: 1, asOf: '2026-11-07', sourceMode: 'fixture',
    accounts: [{ id: 'card', userId: context.userId, connected: true, kind: 'credit_card' }],
    transactions: ['2026-09-01','2026-10-01','2026-11-01'].map((date,i) => ({ id: `charge-${i}`, userId: context.userId, accountId: 'card',
      merchant: 'Spotify', date, deltaCents: i === 2 ? 1999 : 1599 })),
    subscriptions: [{ id: 'music', userId: context.userId, accountId: 'card', merchant: 'Spotify', category: 'music', preferences: {
      confirmed: true, usage: 'used', country: 'US', required_features: ['ad-free music','offline listening'],
      accounts: 1, new_customer: false, upfront_budget_cents: 10000, keep_service: true,
    } }],
  };
}

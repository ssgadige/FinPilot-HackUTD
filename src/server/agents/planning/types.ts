import type { SourceMode } from '../../../../contracts/types.ts';
import type { Context } from '../runtime/tools.ts';
export interface PlanningAccount {
  id: string; userId: string; connected: boolean;
  kind: 'checking' | 'savings' | 'wallet' | 'credit_card' | 'loan' | 'cd' | 'brokerage' | 'ira';
  balanceCents: number; bufferCents: number;
}
export interface Debt {
  id: string; userId: string; accountId: string; paymentAccountId: string;
  kind: 'credit_card' | 'loan'; balanceCents: number;
  aprBps: number | null; minimumCents: number | null; creditLimitCents: number | null; dueDate: string;
}
export interface Goal {
  id: string; userId: string; accountId: string; title: string;
  targetCents: number; savedCents: number; deadline: string; priority: number;
}
export interface Bill {
  id: string; userId: string; accountId: string; amountCents: number; dueDate: string; debtId?: string;
}
export interface CostChange {
  id: string; userId: string; accountId: string; billId: string;
  accepted: boolean; effectiveDate: string; oldCents: number; newCents: number;
}
export interface PlanningSnapshot {
  userId: string; version: number; asOf: string; sourceMode: SourceMode; reconciled: boolean;
  accounts: PlanningAccount[]; debts: Debt[]; goals: Goal[]; bills: Bill[]; costChanges: CostChange[];
}
export type PlanningLoader = (context: Context, signal: AbortSignal) => Promise<PlanningSnapshot>;

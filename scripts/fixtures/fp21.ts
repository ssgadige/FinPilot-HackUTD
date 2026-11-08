import { fixture as planningFixture } from './fp20.ts';
import type { ToolContext } from '../../contracts/types.ts';
import type { StressSnapshot } from '../../src/server/agents/stress/calculations.ts';
export const context:ToolContext={userId:'fp21-demo',runId:'fp21-acceptance',snapshotVersion:1,allowedAccountIds:['checking','card','cd']};
export function fixture():StressSnapshot {
  const planning=planningFixture();planning.userId=context.userId;
  for(const rows of [planning.accounts,planning.debts,planning.goals,planning.bills,planning.costChanges])for(const row of rows)row.userId=context.userId;
  return {planning,incomes:[{id:'paycheck',userId:context.userId,accountId:'checking',date:'2026-11-10',amountCents:100000,confirmed:true}]};
}

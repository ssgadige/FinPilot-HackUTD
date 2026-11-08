import type { ToolContext } from '../../contracts/types.ts';
import type { PlanningSnapshot } from '../../src/server/agents/planning/types.ts';
export const context:ToolContext={userId:'fp20-demo',runId:'fp20-acceptance',snapshotVersion:1,allowedAccountIds:['checking','card','cd']};
export function fixture():PlanningSnapshot {
  const userId=context.userId;
  return {userId,version:1,asOf:'2026-11-07',sourceMode:'fixture',reconciled:true,
    accounts:[
      {id:'checking',userId,connected:true,kind:'checking',balanceCents:500000,bufferCents:100000},
      {id:'card',userId,connected:true,kind:'credit_card',balanceCents:300000,bufferCents:0},
      {id:'cd',userId,connected:true,kind:'cd',balanceCents:900000,bufferCents:0},
    ],
    debts:[{id:'card-debt',userId,accountId:'card',paymentAccountId:'checking',kind:'credit_card',balanceCents:300000,aprBps:2400,minimumCents:10000,creditLimitCents:600000,dueDate:'2026-11-20'}],
    goals:[{id:'car-goal',userId,accountId:'checking',title:'Car savings',targetCents:300000,savedCents:50000,deadline:'2027-11-07',priority:1}],
    bills:[
      {id:'rent',userId,accountId:'checking',amountCents:120000,dueDate:'2026-11-10'},
      {id:'music',userId,accountId:'checking',amountCents:2000,dueDate:'2026-11-12'},
      {id:'minimum',userId,accountId:'checking',amountCents:10000,dueDate:'2026-11-20',debtId:'card-debt'},
    ],
    costChanges:[
      {id:'accepted-music',userId,accountId:'checking',billId:'music',accepted:true,effectiveDate:'2026-11-09',oldCents:2000,newCents:1500},
      {id:'unconfirmed-rent',userId,accountId:'checking',billId:'rent',accepted:false,effectiveDate:'2026-11-08',oldCents:120000,newCents:1},
    ],
  };
}

import { z } from 'zod';
const text=z.string().max(2000),ids=z.array(z.string().min(1).max(200)).max(100);
export const specialist=z.enum(['data-integrity','cash-collision','subscription-detective','deal-scout','debt-readiness','goal-allocator','stress-test','plan-repair']);
export const role=z.enum(['coordinator','chat',...specialist.options]);
export const agentResult=z.strictObject({
  agent_id:role,status:z.enum(['completed','needs_information','failed','skipped']),headline:text,
  findings:z.array(z.strictObject({id:text,severity:z.enum(['info','opportunity','warning','urgent']),summary:text,evidence_ids:ids,amount_cents:z.number().int().safe().nullable()})).max(50),
  evidence_ids:ids,assumptions:z.array(text).max(50),missing_data:z.array(text).max(50),
  proposed_actions:z.array(z.strictObject({id:text,type:z.enum(['save_plan','review_subscription','adjust_goal','review_payment']),description:text,requires_confirmation:z.literal(true)})).max(30),
  snapshot_version:z.number().int().min(0),selected_specialists:z.array(specialist).max(8).refine(a=>new Set(a).size===a.length).optional()
});

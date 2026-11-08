import { runAgent } from './runtime/index.ts';
import type { RuntimeOptions } from './runtime/index.ts';
export function runDebt(options: Omit<RuntimeOptions,'role'|'dependency'>) {
  return runAgent({...options,role:'debt-readiness'});
}

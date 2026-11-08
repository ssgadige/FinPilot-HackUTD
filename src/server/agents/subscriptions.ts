import { runAgent } from './runtime/index.ts';
import type { RuntimeOptions } from './runtime/index.ts';
export function runSubscriptions(options: Omit<RuntimeOptions, 'role' | 'dependency'>) {
  return runAgent({ ...options, role: 'subscription-detective' });
}

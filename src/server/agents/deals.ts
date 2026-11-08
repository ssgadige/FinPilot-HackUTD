import { runAgent } from './runtime/index.ts';
import type { RuntimeOptions } from './runtime/index.ts';
export function runDeals(options: Omit<RuntimeOptions, 'role' | 'dependency'> & { dependency: NonNullable<RuntimeOptions['dependency']> }) {
  return runAgent({ ...options, role: 'deal-scout' });
}

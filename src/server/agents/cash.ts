import { runAgent } from './runtime/index.ts';
import type { RuntimeOptions } from './runtime/index.ts';
export function runCash(options: Omit<RuntimeOptions, 'role' | 'dependency'> & { dependency: NonNullable<RuntimeOptions['dependency']> }) {
  return runAgent({ ...options, role: 'cash-collision' });
}

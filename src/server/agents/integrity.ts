import { runAgent } from './runtime/index.ts';
import type { RuntimeOptions } from './runtime/index.ts';
export function runIntegrity(options: Omit<RuntimeOptions, 'role' | 'dependency'>) {
  return runAgent({ ...options, role: 'data-integrity' });
}

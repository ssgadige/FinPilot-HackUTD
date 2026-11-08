import { runAgent } from './runtime/index.ts';
import type { RuntimeOptions } from './runtime/index.ts';
export function runStress(options:Omit<RuntimeOptions,'role'|'dependency'> & {dependency:NonNullable<RuntimeOptions['dependency']>}) {
  return runAgent({...options,role:'stress-test'});
}

import contract from '../../../../contracts/agent-result.schema.json';
// Small validator for the exact JSON Schema vocabulary in the frozen result contract.
export const resultSchema: any = structuredClone(contract);
export function matches(value: unknown, schema: any): boolean {
  if (schema.const !== undefined && value !== schema.const) return false;
  if (schema.enum && !schema.enum.includes(value)) return false;
  const types = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
  if (types.length && !types.some((t: string) => t === 'null' ? value === null :
    t === 'integer' ? Number.isSafeInteger(value) : t === 'array' ? Array.isArray(value) :
    t === 'object' ? !!value && typeof value === 'object' && !Array.isArray(value) : typeof value === t)) return false;
  if (typeof value === 'number' && schema.minimum !== undefined && value < schema.minimum) return false;
  if (Array.isArray(value)) {
    if (value.length > 100 || (schema.uniqueItems && new Set(value.map(v => JSON.stringify(v))).size !== value.length)) return false;
    if (schema.items && !value.every(v => matches(v, schema.items))) return false;
  } else if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (schema.required?.some((k: string) => !Object.hasOwn(obj, k))) return false;
    if (schema.additionalProperties === false && Object.keys(obj).some(k => !Object.hasOwn(schema.properties || {}, k))) return false;
    if (Object.entries(schema.properties || {}).some(([k, s]) => Object.hasOwn(obj, k) && !matches(obj[k], s))) return false;
  }
  return !(typeof value === 'string' && value.length > 8000);
}

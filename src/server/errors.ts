export class ApiFailure extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export function fail(status: number, code: string, message: string): never { throw new ApiFailure(status, code, message); }
export function found<T>(value: T | undefined): T {
  if (!value) fail(404, 'not_found', 'Object not found');
  return value;
}

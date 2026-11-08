// Symbol.for survives Next.js route/page bundle boundaries around cached services.
const apiFailureBrand = Symbol.for('finpilot.ApiFailure');
export class ApiFailure extends Error {
  readonly [apiFailureBrand] = true;
  public status:number;
  public code:string;
  constructor(status: number, code: string, message: string) { super(message); this.status=status; this.code=code; }
}
export function isApiFailure(error: unknown): error is ApiFailure {
  return typeof error === 'object' && error !== null &&
    apiFailureBrand in error && error[apiFailureBrand] === true;
}
export function fail(status: number, code: string, message: string): never { throw new ApiFailure(status, code, message); }
export function found<T>(value: T | undefined): T {
  if (!value) fail(404, 'not_found', 'Object not found');
  return value;
}

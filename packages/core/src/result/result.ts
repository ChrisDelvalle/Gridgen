/**
 * Successful operation result.
 *
 * @template Value Value returned by the operation.
 * @property ok Success discriminator.
 * @property value Successful operation value.
 */
export interface OkResult<Value> {
  readonly ok: true;
  readonly value: Value;
}

/**
 * Failed operation result.
 *
 * @template Failure Failure returned by the operation.
 * @property error Expected operation failure.
 * @property ok Failure discriminator.
 */
export interface ErrResult<Failure> {
  readonly error: Failure;
  readonly ok: false;
}

/**
 * Typed result for operations that can fail in expected ways.
 *
 * @template Value Value returned by successful operations.
 * @template Failure Failure returned by failed operations.
 */
export type Result<Value, Failure> = ErrResult<Failure> | OkResult<Value>;

/**
 * Wraps a successful operation value.
 *
 * @template Value Value returned by the operation.
 * @param value Successful value.
 * @returns Success result.
 */
export function ok<Value>(value: Value): OkResult<Value> {
  return {
    ok: true,
    value
  };
}

/**
 * Wraps an expected operation failure.
 *
 * @template Failure Failure returned by the operation.
 * @param error Expected failure.
 * @returns Failure result.
 */
export function err<Failure>(error: Failure): ErrResult<Failure> {
  return {
    error,
    ok: false
  };
}

/**
 * Checks whether a result is successful.
 *
 * @template Value Value returned by successful operations.
 * @template Failure Failure returned by failed operations.
 * @param result Result to inspect.
 * @returns True when the result contains a value.
 */
export function isOk<Value, Failure>(result: Result<Value, Failure>): result is OkResult<Value> {
  return result.ok;
}

/**
 * Checks whether a result is an expected failure.
 *
 * @template Value Value returned by successful operations.
 * @template Failure Failure returned by failed operations.
 * @param result Result to inspect.
 * @returns True when the result contains an error.
 */
export function isErr<Value, Failure>(
  result: Result<Value, Failure>
): result is ErrResult<Failure> {
  return !result.ok;
}

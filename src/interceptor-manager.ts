import { FUNCTION } from './constants';
import type { InterceptorFunction } from './types/interceptor-manager';
import { isObject } from './utils';

/**
 * Applies interceptors to the object. Interceptors can be a single function or an array of functions.
 *
 * @template T - Type of the object.
 * @template Args - Type of additional arguments.
 * @template I - Type of interceptors.
 *
 * @param {InterceptorFunction<T, Args> | InterceptorFunction<T, Args>[]} [interceptors] - Interceptor function(s).
 * @param {T} data - The data object to process.
 * @param {...Args} args - Additional arguments to pass to interceptors.
 *
 * @returns {Promise<void>} - Nothing as the function is non-idempotent.
 */
export async function applyInterceptors<
  T extends object,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Args extends any[] = any[],
  I = InterceptorFunction<T, Args> | InterceptorFunction<T, Args>[],
>(interceptors: I | undefined, data: T, ...args: Args): Promise<void> {
  if (!interceptors) {
    return;
  }

  const merge = (v: unknown) =>
    v && isObject(data) && isObject(v) && Object.assign(data, v);

  if (typeof interceptors === FUNCTION) {
    merge(await (interceptors as InterceptorFunction<T, Args>)(data, ...args));
  } else if (Array.isArray(interceptors)) {
    for (const interceptor of interceptors) {
      merge(await interceptor(data, ...args));
    }
  }
}

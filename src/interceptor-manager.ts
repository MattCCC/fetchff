import { isObject } from './utils';

type InterceptorFunction<T> = (object: T) => Promise<T>;

/**
 * Applies interceptors to the object. Interceptors can be a single function or an array of functions.
 *
 * @template T - Type of the object.
 * @template I - Type of interceptors.
 *
 * @param {T} data - The data object to process.
 * @param {InterceptorFunction<T> | InterceptorFunction<T>[]} [interceptors] - Interceptor function(s).
 *
 * @returns {Promise<void>} - Nothing as the function is non-idempotent.
 */
export async function applyInterceptor<
  T extends object,
  I = InterceptorFunction<T> | InterceptorFunction<T>[],
>(data: T, interceptors?: I): Promise<void> {
  if (!interceptors) {
    return;
  }

  if (typeof interceptors === 'function') {
    const value = await interceptors(data);

    if (value && isObject(data) && isObject(value)) {
      Object.assign(data, value);
    }
  } else if (Array.isArray(interceptors)) {
    for (const interceptor of interceptors) {
      const value = await interceptor(data);

      if (value && isObject(data) && isObject(value)) {
        Object.assign(data, value);
      }
    }
  }
}

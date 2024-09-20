/* eslint-disable @typescript-eslint/no-explicit-any */
type InterceptorFunction<T> = (object: T) => Promise<T>;

/**
 * Applies interceptors to the object. Interceptors can be a single function or an array of functions.
 *
 * @template T - Type of the object.
 * @template I - Type of interceptors.
 *
 * @param {T} object - The object to process.
 * @param {InterceptorFunction<T> | InterceptorFunction<T>[]} [interceptors] - Interceptor function(s).
 *
 * @returns {Promise<T>} - The modified object.
 */
export async function applyInterceptor<
  T = any,
  I = InterceptorFunction<T> | InterceptorFunction<T>[],
>(object: T, interceptors?: I): Promise<T> {
  if (!interceptors) {
    return object;
  }

  if (typeof interceptors === 'function') {
    return await interceptors(object);
  }

  if (Array.isArray(interceptors)) {
    for (const interceptor of interceptors) {
      object = await interceptor(object);
    }
  }

  return object;
}

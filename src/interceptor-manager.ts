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
 * @returns {Promise<void>} - Nothing as the function is non-idempotent.
 */
export async function applyInterceptor<
  T extends object,
  I = InterceptorFunction<T> | InterceptorFunction<T>[],
>(object: T, interceptors?: I): Promise<void> {
  if (!interceptors) {
    return;
  }

  if (typeof interceptors === 'function') {
    const value = await interceptors(object);

    if (value) {
      Object.assign(object, value);
    }
  } else if (Array.isArray(interceptors)) {
    for (const interceptor of interceptors) {
      const value = await interceptor(object);

      if (value) {
        Object.assign(object, value);
      }
    }
  }
}

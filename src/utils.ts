/* eslint-disable @typescript-eslint/no-explicit-any */
import type { QueryParams, UrlPathParams } from './types';

/**
 * Appends query parameters to the given URL
 *
 * @param {string} url - The base URL to which query parameters will be appended.
 * @param {QueryParams} params - An instance of URLSearchParams containing the query parameters to append.
 * @returns {string} - The URL with the appended query parameters.
 */
export function appendQueryParams(url: string, params: QueryParams): string {
  if (!params) {
    return url;
  }

  // We don't use URLSearchParams here as we want to ensure that arrays are properly converted similarily to Axios
  // So { foo: [1, 2] } would become: foo[]=1&foo[]=2
  const queryString = Object.entries(params)
    .flatMap(([key, value]) => {
      const encodedKey = encodeURIComponent(key);

      if (Array.isArray(value)) {
        return value.map((val) => `${encodedKey}[]=${encodeURIComponent(val)}`);
      }
      return `${encodedKey}=${encodeURIComponent(String(value))}`;
    })
    .join('&')
    // According to https://datatracker.ietf.org/doc/html/rfc3986 exclamation marks should be replaced
    .replace(/!/g, '%21');

  return url.includes('?')
    ? `${url}&${queryString}`
    : queryString
      ? `${url}?${queryString}`
      : url;
}

/**
 * Replaces dynamic URI parameters in a URL string with values from the provided `urlPathParams` object.
 * Parameters in the URL are denoted by `:<paramName>`, where `<paramName>` is a key in `urlPathParams`.
 *
 * @param {string} url - The URL string containing placeholders in the format `:<paramName>`.
 * @param {Object} urlPathParams - An object containing the parameter values to replace placeholders.
 * @param {string} urlPathParams.paramName - The value to replace the placeholder `:<paramName>` in the URL.
 * @returns {string} - The URL string with placeholders replaced by corresponding values from `urlPathParams`.
 */
export function replaceUrlPathParams(
  url: string,
  urlPathParams: UrlPathParams,
): string {
  if (!urlPathParams) {
    return url;
  }

  return url.replace(/:[a-zA-Z]+/gi, (str): string => {
    const word = str.substring(1);

    return String(urlPathParams[word] ? urlPathParams[word] : str);
  });
}

/**
 * Checks if a value is JSON serializable.
 *
 * JSON serializable values include:
 * - Primitive types: string, number, boolean, null
 * - Arrays
 * - Plain objects (i.e., objects without special methods)
 * - Values with a `toJSON` method
 *
 * @param {any} value - The value to check for JSON serializability.
 * @returns {boolean} - Returns `true` if the value is JSON serializable, otherwise `false`.
 */
export function isJSONSerializable(value: any): boolean {
  if (value === undefined || value === null) {
    return false;
  }

  const t = typeof value;
  if (t === 'string' || t === 'number' || t === 'boolean') {
    return true;
  }

  if (t !== 'object') {
    return false; // bigint, function, symbol, undefined
  }

  if (Array.isArray(value)) {
    return true;
  }

  if (Buffer.isBuffer(value)) {
    return false;
  }

  if (value instanceof Date) {
    return false;
  }

  const proto = Object.getPrototypeOf(value);

  // Check if the prototype is `Object.prototype` or `null` (plain object)
  if (proto === Object.prototype || proto === null) {
    return true;
  }

  // Check if the object has a toJSON method
  if (typeof value.toJSON === 'function') {
    return true;
  }

  return false;
}

export async function delayInvocation(ms: number): Promise<boolean> {
  return new Promise((resolve) =>
    setTimeout(() => {
      return resolve(true);
    }, ms),
  );
}

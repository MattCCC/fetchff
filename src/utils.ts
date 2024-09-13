/* eslint-disable @typescript-eslint/no-explicit-any */
import type { QueryParams, UrlPathParams } from './types';

/**
 * Appends query parameters to a given URL.
 *
 * @param {string} url - The base URL to which query parameters will be appended.
 * @param {QueryParams} params - An object containing the query parameters to append.
 * @returns {string} - The URL with the appended query parameters.
 */
export function appendQueryParams(url: string, params: QueryParams): string {
  if (!params) {
    return url;
  }

  // Check if `params` is an instance of URLSearchParams and bail early if it is
  if (params instanceof URLSearchParams) {
    const encodedQueryString = params.toString();

    return url.includes('?')
      ? `${url}&${encodedQueryString}`
      : encodedQueryString
        ? `${url}?${encodedQueryString}`
        : url;
  }

  // This is exact copy of what JQ used to do. It works much better than URLSearchParams
  const s: string[] = [];
  const add = function (k: string, v: any) {
    v = typeof v === 'function' ? v() : v;
    v = v === null ? '' : v === undefined ? '' : v;
    s[s.length] = encodeURIComponent(k) + '=' + encodeURIComponent(v);
  };

  const buildParams = (prefix: string, obj: any) => {
    let i: number, len: number, key: string;

    if (prefix) {
      if (Array.isArray(obj)) {
        for (i = 0, len = obj.length; i < len; i++) {
          buildParams(
            prefix +
              '[' +
              (typeof obj[i] === 'object' && obj[i] ? i : '') +
              ']',
            obj[i],
          );
        }
      } else if (typeof obj === 'object' && obj !== null) {
        for (key in obj) {
          buildParams(prefix + '[' + key + ']', obj[key]);
        }
      } else {
        add(prefix, obj);
      }
    } else if (Array.isArray(obj)) {
      for (i = 0, len = obj.length; i < len; i++) {
        add(obj[i].name, obj[i].value);
      }
    } else {
      for (key in obj) {
        buildParams(key, obj[key]);
      }
    }
    return s;
  };

  const queryStringParts = buildParams('', params).join('&');

  // Encode special characters as per RFC 3986, https://datatracker.ietf.org/doc/html/rfc3986
  const encodedQueryString = queryStringParts.replace(/%5B%5D/g, '[]'); // Keep '[]' for arrays

  return url.includes('?')
    ? `${url}&${encodedQueryString}`
    : encodedQueryString
      ? `${url}?${encodedQueryString}`
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

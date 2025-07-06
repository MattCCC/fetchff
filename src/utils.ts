/* eslint-disable @typescript-eslint/no-explicit-any */
import { FUNCTION, OBJECT, STRING, UNDEFINED } from './constants';
import type {
  DefaultUrlParams,
  HeadersObject,
  QueryParams,
  UrlPathParams,
} from './types';

// Prevent stack overflow with recursion depth limit
const MAX_DEPTH = 10;

const dangerousProps = ['__proto__', 'constructor', 'prototype'];

export function isSearchParams(data: unknown): boolean {
  return data instanceof URLSearchParams;
}

/**
 * Determines if a value is a non-null object.
 *
 * @param {any} value - The value to check.
 * @returns {boolean} - True if the value is a non-null object.
 */
export function isObject(value: any): value is Record<string, any> {
  return value !== null && typeof value === OBJECT;
}

/**
 * Shallowly serializes an object by converting its key-value pairs into a string representation.
 * This function does not recursively serialize nested objects.
 *
 * @param obj - The object to serialize.
 * @returns A string representation of the object's top-level properties.
 */
export function shallowSerialize(obj: Record<string, any>): string {
  let result = '';

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      result += key + ':' + obj[key];
    }
  }

  return result;
}

/**
 * Removes properties that could lead to prototype pollution from an object.
 *
 * This function creates a shallow copy of the input object with dangerous
 * properties like '__proto__', 'constructor', and 'prototype' removed.
 *
 * @param obj - The object to sanitize
 * @returns A new object without dangerous properties
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const safeObj = { ...obj };

  delete safeObj.__proto__;
  delete (safeObj as any).constructor;
  delete safeObj.prototype;

  return safeObj;
}

/**
 * Sorts the keys of an object and returns a new object with sorted keys.
 *
 * This function is optimized for performance by minimizing the number of object operations
 * and using a single pass to create the sorted object.
 *
 * @param {Object} obj - The object to be sorted by keys.
 * @returns {Object} - A new object with keys sorted in ascending order.
 */
export function sortObject(obj: Record<string, any>): object {
  const sortedObj = {} as Record<string, string>;
  const keys = Object.keys(obj);

  keys.sort();

  for (let i = 0, len = keys.length; i < len; i++) {
    const key = keys[i];

    // Skip dangerous property names to prevent prototype pollution
    if (dangerousProps.includes(key)) {
      continue;
    }

    sortedObj[key] = obj[key];
  }

  return sortedObj;
}

/**
 * Appends a query string to a URL, ensuring proper handling of existing query parameters.
 *
 * @param baseUrl - The base URL to which the query string will be appended.
 * @param queryString - The encoded query string to append.
 * @returns The URL with the appended query string, or the original URL if no query string is provided.
 */
function appendQueryStringToUrl(baseUrl: string, queryString: string): string {
  if (!queryString) {
    return baseUrl;
  }

  return baseUrl.includes('?')
    ? `${baseUrl}&${queryString}`
    : `${baseUrl}?${queryString}`;
}

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
  if (isSearchParams(params)) {
    const encodedQueryString = params.toString();

    return appendQueryStringToUrl(url, encodedQueryString);
  }

  // This is exact copy of what JQ used to do. It works much better than URLSearchParams
  const s: string[] = [];
  const encode = encodeURIComponent;
  const add = (k: string, v: any) => {
    v = typeof v === FUNCTION ? v() : v;
    v = v === null ? '' : v === undefined ? '' : v;
    s[s.length] = encode(k) + '=' + encode(v);
  };

  const buildParams = (prefix: string, obj: any, depth = 0) => {
    // Stop recursion if maximum depth is reached
    if (depth >= MAX_DEPTH) {
      return s;
    }

    let i: number, len: number, key: string;

    if (prefix) {
      if (Array.isArray(obj)) {
        for (i = 0, len = obj.length; i < len; i++) {
          buildParams(
            prefix + '[' + (typeof obj[i] === OBJECT && obj[i] ? i : '') + ']',
            obj[i],
            depth + 1,
          );
        }
      } else if (isObject(obj)) {
        for (key in obj) {
          buildParams(prefix + '[' + key + ']', obj[key], depth + 1);
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
        buildParams(key, obj[key], depth + 1);
      }
    }
    return s;
  };

  const queryStringParts = buildParams('', params).join('&');

  // Encode special characters as per RFC 3986, https://datatracker.ietf.org/doc/html/rfc3986
  // This is for compatibility with server frameworks that expect the literal notation
  const encodedQueryString = queryStringParts.replace(/%5B%5D/g, '[]'); // Keep '[]' for arrays

  return appendQueryStringToUrl(url, encodedQueryString);
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
  if (!urlPathParams || url.indexOf(':') === -1) {
    return url;
  }

  // Use a single RegExp and avoid unnecessary casts and function calls
  // Precompute keys for faster lookup
  const params = urlPathParams as DefaultUrlParams;

  // Use a replacer function that avoids extra work
  return url.replace(/:([a-zA-Z0-9_]+)/g, (match, key) => {
    // Use hasOwnProperty for strict key existence check
    if (Object.prototype.hasOwnProperty.call(params, key)) {
      const value = params[key];

      // Only replace if value is not undefined or null
      if (value !== undefined && value !== null) {
        return encodeURIComponent(String(value));
      }
    }

    return match;
  });
}

/**
 * Determines whether the provided URL is absolute.
 *
 * An absolute URL contains a scheme (e.g., "http://", "https://").
 *
 * @param url - The URL string to check.
 * @returns `true` if the URL is absolute, otherwise `false`.
 */
export function isAbsoluteUrl(url: string): boolean {
  return url.includes('://');
}

export const timeNow = () => Date.now();

export const noop = () => {};

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
  const t = typeof value;

  if (value === undefined || value === null) {
    return false;
  }

  if (t === STRING || t === 'number' || t === 'boolean') {
    return true;
  }

  if (Array.isArray(value)) {
    return true;
  }

  if (
    typeof globalThis !== UNDEFINED &&
    typeof globalThis.Buffer !== UNDEFINED &&
    globalThis.Buffer.isBuffer(value)
  ) {
    return false;
  }

  if (value instanceof Date) {
    return false;
  }

  if (isObject(value)) {
    const proto = Object.getPrototypeOf(value);

    // Check if the prototype is `Object.prototype` (plain object)
    if (proto === Object.prototype) {
      return true;
    }

    // Check if the object has a toJSON method
    if (typeof value.toJSON === FUNCTION) {
      return true;
    }
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

/**
 * Recursively flattens the data object if it meets specific criteria.
 *
 * The method checks if the provided `data` is an object with exactly one property named `data`.
 * If so, it recursively flattens the `data` property. Otherwise, it returns the `data` as-is.
 *
 * @param {any} data - The data to be flattened. Can be of any type, including objects, arrays, or primitives.
 * @returns {any} - The flattened data if the criteria are met; otherwise, the original `data`.
 */
export function flattenData(data: any, depth = 0): any {
  if (depth >= MAX_DEPTH) {
    return data;
  }

  if (
    data &&
    isObject(data) &&
    typeof data.data !== UNDEFINED &&
    Object.keys(data).length === 1
  ) {
    return flattenData(data.data, depth + 1);
  }

  return data;
}

/**
 * Processes headers and returns them as a normalized object.
 *
 * Handles both `Headers` instances and plain objects. Normalizes header keys to lowercase
 * as per RFC 2616 section 4.2.
 *
 * @param headers - The headers to process. Can be an instance of `Headers`, a plain object,
 *                   or `null`. If `null`, an empty object is returned.
 * @returns {HeadersObject} - A normalized headers object with lowercase keys.
 */
export function processHeaders(
  headers?: (HeadersObject & HeadersInit) | null | Headers,
): HeadersObject {
  if (!headers) {
    return {};
  }

  const headersObject: HeadersObject = {};

  // Handle Headers object with entries() method
  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      headersObject[key] = value;
    });
  } else if (isObject(headers)) {
    // Handle plain object
    for (const [key, value] of Object.entries(headers)) {
      // Normalize keys to lowercase as per RFC 2616 4.2
      // https://datatracker.ietf.org/doc/html/rfc2616#section-4.2
      headersObject[key.toLowerCase()] = value;
    }
  }

  return headersObject;
}

/**
 * Determines if the current environment is a browser.
 *
 * @returns {boolean} - True if running in a browser environment, false otherwise.
 */
export function isBrowser(): boolean {
  // For node and and some mobile frameworks like React Native, `add/removeEventListener` doesn't exist on window!
  return (
    typeof window !== UNDEFINED && typeof window.addEventListener === FUNCTION
  );
}

/**
 * Detects if the user is on a slow network connection
 * @returns {boolean} True if connection is slow, false otherwise or if detection unavailable
 */
export const isSlowConnection = (): boolean => {
  // Only works in browser environments
  if (!isBrowser()) {
    return false;
  }

  const conn = navigator && (navigator as any).connection;

  return conn && ['slow-2g', '2g', '3g'].includes(conn.effectiveType);
};

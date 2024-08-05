import { RequestConfig } from './types';

// Garbage collected hash cache table
// Since we use hashtable, it is really fast
const hashCache = new WeakMap<object>();

/**
 * FNV-1a Hash Function Implementation
 * It's non-crypto and very fast
 * We avoid BigInt here due to compatibility issues (ES2020), and the bundle size
 * @url https://en.wikipedia.org/wiki/Fowler%E2%80%93Noll%E2%80%93Vo_hash_function
 *
 * @param input Input string to hash
 * @returns {string} Hash
 */
export function hash(input: string): string {
  // FNV-1a 32-bit offset basis
  let hash = 2166136261;

  // FNV-1a 32-bit prime
  const FNV_32_PRIME = 16777619;

  for (const char of input) {
    hash ^= char.charCodeAt(0);
    hash *= FNV_32_PRIME;
    // Ensure the hash stays within 32-bit unsigned integer range
    hash = hash >>> 0;
  }

  // Convert hash to hexadecimal string, pad to ensure it's always 8 chars long
  return hash.toString(16).padStart(8, '0');
}

/**
 * Computes and retrieves a hash for a given `RequestConfig` object.
 *
 * This function first checks if the hash for the provided `requestConfig` object is
 * already cached. If it is not found in the cache, it serializes the `requestConfig`
 * object into a JSON string, computes a hash for that string using the FNV-1a algorithm,
 * and stores the resulting hash in the cache for future use. The function utilizes a
 * `WeakMap` to manage the cache, ensuring automatic garbage collection of cache entries
 * when the associated `requestConfig` objects are no longer in use.
 *
 * @param {RequestConfig} requestConfig - The configuration object to hash. This object
 *   should have the following properties:
 *   - `method` {string} - The HTTP method (e.g., 'GET', 'POST').
 *   - `baseURL` {string} - The base URL of the API.
 *   - `url` {string} - The specific URL path.
 *   - `params` {object} - The query parameters as key-value pairs.
 *   - `data` {object} - The request body data as key-value pairs.
 *
 * @returns {string} The computed hash for the `requestConfig` object. The hash is
 *   represented as a hexadecimal string of 8 characters, ensuring a fixed length for
 *   consistency and easier comparison.
 */
export function hashFromConfig(requestConfig: RequestConfig): string {
  let key = hashCache.get(requestConfig);

  if (typeof key === 'undefined') {
    const keyString = JSON.stringify(requestConfig);

    key = hash(keyString);
    hashCache.set(requestConfig, key);
  }

  return key;
}

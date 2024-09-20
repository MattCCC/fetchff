const PRIME_MULTIPLIER = 31;

/**
 * Computes a hash value for a given string using the variant of djb2 hash function.
 * This hash function is non-cryptographic and designed for speed.
 * @author Daniel J. Bernstein (of djb2)
 *
 * @param str Input string to hash
 * @returns {string} Hash
 */
export function hash(str: string): string {
  let hash = 0;

  for (let i = 0, len = str.length; i < len; i++) {
    const char = str.charCodeAt(i);
    hash = (hash * PRIME_MULTIPLIER + char) | 0;
  }

  return String(hash);
}

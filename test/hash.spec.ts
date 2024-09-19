import { hash } from '../src/hash';

describe('hash function', () => {
  it('should return a consistent hash for the same input', () => {
    const input = 'test';
    const expectedHash = hash(input);
    expect(hash(input)).toBe(expectedHash);
  });

  it('should return different hashes for different inputs', () => {
    const input1 = 'test1';
    const input2 = 'test2';
    expect(hash(input1)).not.toBe(hash(input2));
  });

  it('should handle an empty string', () => {
    const input = '';
    const expectedHash = '811c9dc5'; // Update with the correct expected hash value
    expect(hash(input)).toBe(expectedHash);
  });

  it('should not return a too long hash', () => {
    const input = 'abcdefghijklmnopqrstuvwxyz'.repeat(1000);

    expect(hash(input).length).toBeLessThan(500);
  });
});

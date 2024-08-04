import { hash, hashFromConfig } from '../src/hash';
import type { RequestConfig } from '../src/types/request-handler';

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

describe('hashFromConfig function', () => {
  it('should return a hash for a given RequestConfig', () => {
    const requestConfig: RequestConfig = {
      method: 'GET',
      baseURL: 'https://api.example.com',
      url: '/endpoint',
      params: { query: 'value' },
      data: { key: 'value' },
    };

    const expectedHash = hash(
      JSON.stringify([
        requestConfig.method,
        requestConfig.baseURL,
        requestConfig.url,
        requestConfig.params,
        requestConfig.data,
      ]),
    );
    expect(hashFromConfig(requestConfig)).toBe(expectedHash);
  });

  it('should cache results to avoid rehashing', () => {
    const requestConfig: RequestConfig = {
      method: 'POST',
      baseURL: 'https://api.example.com',
      url: '/another-endpoint',
      params: { query: 'anotherValue' },
      data: { anotherKey: 'anotherValue' },
    };

    const firstHash = hashFromConfig(requestConfig);
    const secondHash = hashFromConfig(requestConfig);

    expect(firstHash).toBe(secondHash);
  });

  it('should produce different hashes for different RequestConfig objects', () => {
    const config1: RequestConfig = {
      method: 'GET',
      baseURL: 'https://api.example.com',
      url: '/endpoint1',
      params: { query: 'value1' },
      data: { key: 'value1' },
    };

    const config2: RequestConfig = {
      method: 'POST',
      baseURL: 'https://api.example.com',
      url: '/endpoint2',
      params: { query: 'value2' },
      data: { key: 'value2' },
    };

    expect(hashFromConfig(config1)).not.toBe(hashFromConfig(config2));
  });
});

describe('hashFromConfig with cache', () => {
  let hashCacheGetSpy;
  let hashCacheSetSpy;

  beforeEach(() => {
    // Reset spies before each test
    hashCacheGetSpy = jest.spyOn(WeakMap.prototype, 'get');
    hashCacheSetSpy = jest.spyOn(WeakMap.prototype, 'set');
  });

  afterEach(() => {
    // Restore the original implementation after each test
    jest.restoreAllMocks();
  });

  it('should compute and cache the hash for a new RequestConfig', () => {
    const requestConfig: RequestConfig = {
      method: 'GET',
      baseURL: 'https://api.example.com',
      url: '/endpoint',
      params: { query: 'value' },
      data: { key: 'value' },
    };

    const firstHash = hashFromConfig(requestConfig);
    expect(firstHash).toBeDefined();
    expect(hashCacheGetSpy).toHaveBeenCalledTimes(1);
    expect(hashCacheSetSpy).toHaveBeenCalledTimes(1);
  });

  it('should return the cached hash for the same RequestConfig', () => {
    const requestConfig: RequestConfig = {
      method: 'GET',
      baseURL: 'https://api.example.com',
      url: '/endpoint',
      params: { query: 'value' },
      data: { key: 'value' },
    };

    const firstHash = hashFromConfig(requestConfig);
    expect(firstHash).toBeDefined();
    expect(hashCacheGetSpy).toHaveBeenCalledTimes(1);
    expect(hashCacheSetSpy).toHaveBeenCalledTimes(1);

    const secondHash = hashFromConfig(requestConfig);
    expect(secondHash).toBe(firstHash);
    expect(hashCacheGetSpy).toHaveBeenCalledTimes(2); // Verify cache get was called again
    expect(hashCacheSetSpy).toHaveBeenCalledTimes(1); // Verify cache set was not called again
  });

  it('should compute and cache the hash for a different RequestConfig', () => {
    const requestConfig1: RequestConfig = {
      method: 'GET',
      baseURL: 'https://api.example.com',
      url: '/endpoint',
      params: { query: 'value1' },
      data: { key: 'value1' },
    };

    const requestConfig2: RequestConfig = {
      method: 'POST',
      baseURL: 'https://api.example.com',
      url: '/endpoint',
      params: { query: 'value2' },
      data: { key: 'value2' },
    };

    const firstHash = hashFromConfig(requestConfig1);
    expect(firstHash).toBeDefined();
    expect(hashCacheGetSpy).toHaveBeenCalledTimes(1);
    expect(hashCacheSetSpy).toHaveBeenCalledTimes(1);

    const secondHash = hashFromConfig(requestConfig2);
    expect(secondHash).toBeDefined();
    expect(hashCacheGetSpy).toHaveBeenCalledTimes(2);
    expect(hashCacheSetSpy).toHaveBeenCalledTimes(2);
  });
});

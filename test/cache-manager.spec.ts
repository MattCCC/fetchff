import {
  generateCacheKey,
  getCache,
  setCache,
  deleteCache,
  getCachedResponse,
  mutate,
  pruneCache,
  IMMEDIATE_DISCARD_CACHE_TIME,
} from '../src/cache-manager';
import { RequestConfig } from '../src/index';
import * as hashM from '../src/hash';
import * as pubsubManager from '../src/pubsub-manager';
import * as revalidatorManager from '../src/revalidator-manager';
import { clearAllTimeouts } from '../src/timeout-wheel';

jest.mock('../src/index');
jest.mock('../src/pubsub-manager');
jest.mock('../src/revalidator-manager');

describe('Cache Manager', () => {
  beforeAll(() => {
    global.console = {
      ...global.console,
      error: jest.fn(),
    };
    jest.useFakeTimers();
  });

  beforeEach(() => {
    pruneCache();
    clearAllTimeouts();
    jest.clearAllMocks();
    jest.runAllTimers();
    jest.clearAllTimers();
  });

  describe('generateCacheKey', () => {
    const url = 'https://api.example.com/data';

    it('should generate a cache key for basic GET request', () => {
      const key = generateCacheKey({
        url,
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept-Encoding': 'gzip, deflate, br',
        },
      });
      expect(key).toContain('GET|httpsapiexamplecomdata');
    });

    it('should generate a cache key for basic GET request with empty url', () => {
      const key = generateCacheKey({
        method: 'GET',
        headers: new Headers({ 'Content-Type': 'application/json' }),
      } as never);

      expect(key).not.toContain('http');
    });

    it('should generate a cache key for basic GET request with sorted headers', () => {
      const key = generateCacheKey({
        method: 'GET',
        headers: new Headers({
          'Content-Type': 'application/json',
          'Accept-Encoding': 'gzip, deflate, br',
        }),
      } as never);

      expect(key).toContain(
        'accept-encodinggzipdeflatebrcontent-typeapplicationjson',
      );
    });

    it('should generate a cache key for basic GET request with sorted hashed headers', () => {
      const key = generateCacheKey({
        method: 'GET',
        url: 'https://api.example.com/data',
        headers: new Headers({
          'Content-Type': 'application/json',
          'Accept-Encoding': 'gzip, deflate, br',
          'X-Custom-Header': 'customValue'.repeat(10),
        }),
      } as never);

      expect(key).toContain(
        'GET|httpsapiexamplecomdata|same-origin|accept-encodinggzipdeflatebrcontent-typeapplicationjson',
      );
    });

    it('should generate a cache key with sorted headers', () => {
      const key = generateCacheKey({
        url,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      expect(key).toContain(
        'POST|httpsapiexamplecomdata|same-origin|Content-Typeapplicationjson|',
      );
    });

    it('should hash the longer stringified body if provided', () => {
      const spy = jest.spyOn(hashM, 'hash');

      const key = generateCacheKey({
        url,
        method: 'POST',
        body: JSON.stringify({ name: 'Alice' }).repeat(10),
      });
      expect(spy).toHaveBeenCalled();
      expect(key).toContain(
        'POST|httpsapiexamplecomdata|same-origin||655859486',
      );
    });

    it('should hash the longer non-stringified body if provided', () => {
      const spy = jest.spyOn(hashM, 'hash');

      const key = generateCacheKey({
        url,
        method: 'POST',
        body: { name: 'Alice'.repeat(100) },
      });
      expect(spy).toHaveBeenCalled();
      expect(key).toContain(
        'POST|httpsapiexamplecomdata|same-origin||-1171129837',
      );
    });

    it('should not hash shorter body if provided', () => {
      const spy = jest.spyOn(hashM, 'hash');

      const key = generateCacheKey({
        url,
        method: 'POST',
        body: JSON.stringify({ name: 'Alice' }),
      });
      expect(spy).not.toHaveBeenCalled();
      expect(key).toContain(
        'POST|httpsapiexamplecomdata|same-origin||nameAlice',
      );
    });

    it('should convert FormData body to string', () => {
      const formData = new FormData();
      formData.set('something', '1'.repeat(64));

      const key = generateCacheKey({
        url,
        method: 'POST',
        body: formData,
      });
      expect(key).toContain(
        'POST|httpsapiexamplecomdata|same-origin||1870802307',
      );
    });

    it('should handle Blob body', () => {
      const blob = new Blob(['test'], { type: 'text/plain' });
      const key = generateCacheKey({
        url,
        method: 'POST',
        body: blob,
      });
      expect(key).toContain(
        'POST|httpsapiexamplecomdata|same-origin||BF4textplain',
      );
    });

    it('should handle ArrayBuffer body', () => {
      const buffer = new ArrayBuffer(8);
      const key = generateCacheKey({
        url,
        method: 'POST',
        body: buffer,
      });
      expect(key).toContain('AB8');
    });

    it('should handle numbers', () => {
      const key = generateCacheKey({
        url,
        method: 'POST',
        body: 10,
      });
      expect(key).toContain('POST|httpsapiexamplecomdata|same-origin||10');
    });

    it('should handle Array body', () => {
      const arrayBody = [1, 2, 3];
      const key = generateCacheKey({
        url,
        method: 'POST',
        body: arrayBody,
      });
      expect(key).toContain('POST|httpsapiexamplecomdata|same-origin||011223');
    });

    it('should handle Object body and sort properties', () => {
      const objectBody = { b: 2, a: 1 };
      const key = generateCacheKey({
        url,
        method: 'POST',
        body: objectBody,
      });

      expect(key).toContain('POST|httpsapiexamplecomdata|same-origin||a1b2');
    });
  });

  describe('getCacheEntry', () => {
    afterEach(() => {
      deleteCache('key');
    });

    it('should return cache entry if not expired', () => {
      setCache('key', { data: 'test' });
      const result = getCache('key');
      expect(result).not.toBeNull();
      expect(result?.data).toEqual({ data: 'test' });
    });
  });

  describe('setCache', () => {
    afterEach(() => {
      deleteCache('key');
    });

    it('should set cache with proper data', () => {
      const data = { foo: 'bar' };
      setCache('key', data, 60);
      const entry = getCache('key');
      expect(entry?.data).toEqual(data);
    });

    it('should set timestamp when caching data', () => {
      const timestampBefore = Date.now();
      setCache('key', { foo: 'bar' }, 60);
      const entry = getCache('key');
      expect(entry?.time).toBeGreaterThanOrEqual(timestampBefore);
    });
  });

  describe('deleteCache', () => {
    it('should delete cache entry', () => {
      setCache('key', { data: 'test' });
      deleteCache('key');
      expect(getCache('key')).toBe(null);
    });

    it('should do nothing if cache key does not exist', () => {
      deleteCache('nonExistentKey');
      expect(getCache('nonExistentKey')).toBe(null);
    });

    it('should delete cache entry when removeExpired is false (default)', () => {
      setCache('key', { data: 'test' });
      deleteCache('key', false); // Explicitly pass false
      expect(getCache('key')).toBe(null);
    });

    it('should not delete cache entry when removeExpired is true and entry is not expired', () => {
      setCache('key', { data: 'test' }, 60); // Set with 60 second TTL
      deleteCache('key', true); // Only delete if expired
      expect(getCache('key')).not.toBe(null);
      expect(getCache('key')?.data).toEqual({ data: 'test' });
    });

    it('should delete cache entry when removeExpired is true and entry has IMMEDIATE_DISCARD_CACHE_TIME', () => {
      setCache('key', { data: 'test' }, IMMEDIATE_DISCARD_CACHE_TIME); // No TTL = IMMEDIATE_DISCARD_CACHE_TIME
      deleteCache('key', true); // Should delete since IMMEDIATE_DISCARD_CACHE_TIME entries are considered expired when removeExpired is true
      jest.advanceTimersByTime(1000); // Fast-forward time to ensure cache is considered expired
      expect(getCache('key')).toBe(null);
    });

    it('should delete expired cache entry when removeExpired is true', () => {
      // Create an entry that's already expired by using a past timestamp
      setCache('key', { data: 'test' }, -5000); // Set with negative TTL to simulate expiration
      deleteCache('key', true);
      expect(getCache('key')).toBe(null);
    });
  });

  describe('getCachedResponse', () => {
    const cacheKey = 'test-key';
    const fetcherConfig = { url: 'https://api.example.com' } as RequestConfig;
    const cacheTime = 60;
    const responseObj = { data: 'cachedData' };

    afterEach(() => {
      deleteCache(cacheKey);
    });

    it('should return cached response if available and not expired', () => {
      setCache(cacheKey, responseObj, cacheTime);
      const result = getCachedResponse(cacheKey, cacheTime, fetcherConfig);
      expect(result).toEqual(responseObj);
    });

    it('should return null if cacheKey is null', () => {
      setCache(cacheKey, responseObj, cacheTime);
      const result = getCachedResponse(null, cacheTime, fetcherConfig);
      expect(result).toBeNull();
    });

    it('should return null if cacheTime is undefined', () => {
      setCache(cacheKey, responseObj);
      const result = getCachedResponse(cacheKey, undefined, fetcherConfig);
      expect(result).toBeNull();
    });

    it('should return null if cache is expired', () => {
      setCache(cacheKey, responseObj, 1);
      jest.advanceTimersByTime(2000); // Fast-forward time by 2 seconds
      // Simulate expiration by using negative cacheTime
      const result = getCachedResponse(cacheKey, 1, fetcherConfig);
      expect(result).toBeNull();
    });

    it('should not return null and not delete cache if set to -1 (as long as it is used)', () => {
      setCache(cacheKey, responseObj);
      // Simulate expiration by using negative cacheTime
      const result = getCachedResponse(cacheKey, -1, fetcherConfig);
      expect(result).not.toBeNull();
    });

    it('should return null if cacheBuster returns true', () => {
      setCache(cacheKey, responseObj);
      fetcherConfig.cacheBuster = jest.fn().mockReturnValue(true);
      const result = getCachedResponse(cacheKey, cacheTime, fetcherConfig);
      expect(result).toBeNull();
      expect(fetcherConfig.cacheBuster).toHaveBeenCalledWith(fetcherConfig);
    });

    it('should return null if no cache entry exists', () => {
      delete fetcherConfig.cacheBuster;
      const result = getCachedResponse(
        'non-existent-key',
        cacheTime,
        fetcherConfig,
      );
      expect(result).toBeNull();
    });
  });

  describe('mutate', () => {
    const cacheKey = 'test-key';
    const initialData = { data: 'initial', time: Date.now() };
    const newData = { name: 'John', age: 30 };

    afterEach(() => {
      deleteCache(cacheKey);
      jest.clearAllMocks();
    });

    it('should do nothing if no key is provided', async () => {
      const notifySubscribersSpy = jest.spyOn(
        pubsubManager,
        'notifySubscribers',
      );
      const revalidateSpy = jest.spyOn(revalidatorManager, 'revalidate');

      await mutate('', newData);

      expect(notifySubscribersSpy).not.toHaveBeenCalled();
      expect(revalidateSpy).not.toHaveBeenCalled();
    });

    it('should do nothing if cache entry does not exist', async () => {
      const notifySubscribersSpy = jest.spyOn(
        pubsubManager,
        'notifySubscribers',
      );
      const revalidateSpy = jest.spyOn(revalidatorManager, 'revalidate');

      await mutate('non-existent-key', newData);

      expect(notifySubscribersSpy).not.toHaveBeenCalled();
      expect(revalidateSpy).not.toHaveBeenCalled();
    });

    it('should mutate cache and notify subscribers without revalidation', async () => {
      setCache(cacheKey, initialData);
      const notifySubscribersSpy = jest.spyOn(
        pubsubManager,
        'notifySubscribers',
      );
      const revalidateSpy = jest.spyOn(revalidatorManager, 'revalidate');

      await mutate(cacheKey, newData);

      const updatedCache = getCache(cacheKey);
      expect(updatedCache?.data).toEqual({
        ...initialData,
        data: newData,
      });
      expect(notifySubscribersSpy).toHaveBeenCalledWith(cacheKey, {
        ...initialData,
        data: newData,
      });
      expect(revalidateSpy).not.toHaveBeenCalled();
    });

    it('should mutate cache, notify subscribers and revalidate when revalidate setting is true', async () => {
      setCache(cacheKey, initialData);
      const notifySubscribersSpy = jest.spyOn(
        pubsubManager,
        'notifySubscribers',
      );
      const revalidateSpy = jest.spyOn(revalidatorManager, 'revalidate');

      await mutate(cacheKey, newData, { revalidate: true });

      const updatedCache = getCache(cacheKey);
      expect(updatedCache?.data).toEqual({
        ...initialData,
        data: newData,
        time: expect.any(Number),
      });
      expect(notifySubscribersSpy).toHaveBeenCalledWith(cacheKey, {
        ...initialData,
        data: newData,
        time: expect.any(Number),
      });
      expect(revalidateSpy).toHaveBeenCalledWith(cacheKey);
    });

    it('should not revalidate when revalidate setting is false', async () => {
      setCache(cacheKey, initialData);
      const notifySubscribersSpy = jest.spyOn(
        pubsubManager,
        'notifySubscribers',
      );
      const revalidateSpy = jest.spyOn(revalidatorManager, 'revalidate');

      await mutate(cacheKey, newData, { revalidate: false });

      expect(notifySubscribersSpy).toHaveBeenCalled();
      expect(revalidateSpy).not.toHaveBeenCalled();
    });

    it('should handle mutation with undefined settings', async () => {
      setCache(cacheKey, initialData);
      const notifySubscribersSpy = jest.spyOn(
        pubsubManager,
        'notifySubscribers',
      );
      const revalidateSpy = jest.spyOn(revalidatorManager, 'revalidate');

      await mutate(cacheKey, newData, undefined);

      expect(notifySubscribersSpy).toHaveBeenCalled();
      expect(revalidateSpy).not.toHaveBeenCalled();
    });
  });
});

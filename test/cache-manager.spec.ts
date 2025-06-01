import {
  generateCacheKey,
  getCache,
  setCache,
  revalidate,
  deleteCache,
  mutate,
} from '../src/cache-manager';
import { fetchf } from '../src/index';
import * as hashM from '../src/hash';
import * as utils from '../src/utils';

jest.mock('../src/index');

describe('Cache Manager', () => {
  beforeAll(() => {
    global.console = {
      ...global.console,
      error: jest.fn(),
    };
  });

  beforeEach(() => {
    jest.clearAllMocks();
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
      expect(key).toContain(
        'GET|httpsapiexamplecomdata|corssame-origindefaultfollowaboutclient|Accept-EncodinggzipdeflatebrContent-Typeapplicationjson|',
      );
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
        'accept-encodinggzipdeflatebrcontent-typeapplicationjso',
      );
    });

    it('should generate a cache key for basic GET request with sorted hashed headers', () => {
      const key = generateCacheKey({
        method: 'GET',
        headers: new Headers({
          'Content-Type': 'application/json',
          'Accept-Encoding': 'gzip, deflate, br',
          'X-Custom-Header': 'customValue'.repeat(10),
        }),
      } as never);

      expect(key).toContain(
        'GET||corssame-origindefaultfollowaboutclient|1910039066|',
      );
    });

    it('should return an empty string if cache is reload', () => {
      const key = generateCacheKey({
        url,
        cache: 'reload',
      });
      expect(key).toBe('');
    });

    it('should generate a cache key with sorted headers', () => {
      const shallowSerialize = jest.spyOn(utils, 'shallowSerialize');

      const key = generateCacheKey({
        url,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      expect(key).toContain(
        'POST|httpsapiexamplecomdata|corssame-origindefaultfollowaboutclient|Content-Typeapplicationjson|',
      );
      expect(shallowSerialize).toHaveBeenCalledWith({
        'Content-Type': 'application/json',
      });
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
        'POST|httpsapiexamplecomdata|corssame-origindefaultfollowaboutclient||655859486',
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
        'POST|httpsapiexamplecomdata|corssame-origindefaultfollowaboutclient||-1171129837',
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
        'POST|httpsapiexamplecomdata|corssame-origindefaultfollowaboutclient||nameAlice',
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
        'POST|httpsapiexamplecomdata|corssame-origindefaultfollowaboutclient||1870802307',
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
        'POST|httpsapiexamplecomdata|corssame-origindefaultfollowaboutclient||BF4textplain',
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
      expect(key).toContain(
        'POST|httpsapiexamplecomdata|corssame-origindefaultfollowaboutclient||10',
      );
    });

    it('should handle Array body', () => {
      const arrayBody = [1, 2, 3];
      const key = generateCacheKey({
        url,
        method: 'POST',
        body: arrayBody,
      });
      expect(key).toContain(
        'POST|httpsapiexamplecomdata|corssame-origindefaultfollowaboutclient||011223',
      );
    });

    it('should handle Object body and sort properties', () => {
      const objectBody = { b: 2, a: 1 };
      const key = generateCacheKey({
        url,
        method: 'POST',
        body: objectBody,
      });

      expect(key).toContain(
        'POST|httpsapiexamplecomdata|corssame-origindefaultfollowaboutclient||a1b2',
      );
    });
  });

  describe('getCache', () => {
    afterEach(() => {
      deleteCache('key');
    });

    it('should return cache entry if not expired', () => {
      setCache('key', { data: 'test' }, false);
      const result = getCache('key', 0);
      expect(result).not.toBeNull();
      expect(result?.data).toEqual({ data: 'test' });
    });

    it('should return null and delete cache if expired', () => {
      setCache('key', { data: 'test' }, false);
      const result = getCache('key', -1);
      expect(result).toBeNull();
    });

    it('should return null if no cache entry exists', () => {
      const result = getCache('nonExistentKey', 60);
      expect(result).toBeNull();
    });

    it('should delete expired cache entry', () => {
      setCache('key', { data: 'test' }, false);
      deleteCache('key');
      expect(getCache('key', 60)).toBe(null);
    });
  });

  describe('setCache', () => {
    afterEach(() => {
      deleteCache('key');
    });

    it('should set cache with proper data', () => {
      const data = { foo: 'bar' };
      setCache('key', data);
      const entry = getCache('key', 60);
      expect(entry?.data).toEqual(data);
      expect(entry?.isLoading).toBe(false);
    });

    it('should handle isLoading state', () => {
      setCache('key', { foo: 'bar' }, true);
      const entry = getCache('key', 60);
      expect(entry?.isLoading).toBe(true);
    });

    it('should set timestamp when caching data', () => {
      const timestampBefore = Date.now();
      setCache('key', { foo: 'bar' });
      const entry = getCache('key', 60);
      expect(entry?.timestamp).toBeGreaterThanOrEqual(timestampBefore);
    });
  });

  describe('revalidate', () => {
    afterEach(() => {
      deleteCache('key');
    });

    it('should fetch fresh data and update cache', async () => {
      const mockResponse = { data: 'newData' };
      (fetchf as jest.Mock).mockResolvedValue(mockResponse);

      await revalidate('key', { url: 'https://api.example.com' });
      const entry = getCache('key', 60);
      expect(entry?.data).toEqual(mockResponse);
    });

    it('should handle fetch errors during revalidation', async () => {
      const errorMessage = 'Fetch failed';
      (fetchf as jest.Mock).mockRejectedValue(new Error(errorMessage));

      await expect(
        revalidate('key', { url: 'https://api.example.com' }),
      ).rejects.toThrow(errorMessage);
      const entry = getCache('key', 60);
      expect(entry?.data).toBeUndefined();
    });

    it('should not update cache if revalidation fails', async () => {
      const errorMessage = 'Fetch failed';
      const oldData = { data: 'oldData' };

      (fetchf as jest.Mock).mockRejectedValue(new Error(errorMessage));
      setCache('key', oldData);

      await expect(
        revalidate('key', { url: 'https://api.example.com' }),
      ).rejects.toThrow(errorMessage);
      const entry = getCache('key', 60);
      expect(entry?.data).toEqual(oldData);
    });
  });

  describe('deleteCache', () => {
    it('should delete cache entry', () => {
      setCache('key', { data: 'test' });
      deleteCache('key');
      expect(getCache('key', 60)).toBe(null);
    });

    it('should do nothing if cache key does not exist', () => {
      deleteCache('nonExistentKey');
      expect(getCache('nonExistentKey', 60)).toBe(null);
    });
  });

  describe('mutate', () => {
    it('should mutate cache entry with new data', () => {
      setCache('key', { data: 'oldData' });
      mutate('key', { url: 'https://api.example.com' }, { data: 'newData' });
      const entry = getCache('key', 60);
      expect(entry?.data).toEqual({ data: 'newData' });
    });

    it('should revalidate after mutation if revalidateAfter is true', async () => {
      const mockResponse = { data: 'newData' };
      (fetchf as jest.Mock).mockResolvedValue(mockResponse);

      await mutate(
        'key',
        { url: 'https://api.example.com' },
        { data: 'mutatedData' },
        true,
      );
      const entry = getCache('key', 60);
      expect(entry?.data).toEqual(mockResponse);
    });

    it('should not revalidate after mutation if revalidateAfter is false', async () => {
      setCache('key', { data: 'oldData' });
      mutate(
        'key',
        { url: 'https://api.example.com' },
        { data: 'newData' },
        false,
      );
      expect(fetchf).not.toHaveBeenCalled();
    });
  });
});

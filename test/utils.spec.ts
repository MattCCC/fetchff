import {
  isJSONSerializable,
  replaceUrlPathParams,
  appendQueryParams,
  delayInvocation,
  processHeaders,
} from '../src/utils';

describe('Utils', () => {
  console.warn = jest.fn();

  afterEach((done) => {
    done();
  });

  describe('isJSONSerializable()', () => {
    it('should return false for undefined', () => {
      expect(isJSONSerializable(undefined)).toBe(false);
    });

    it('should return false for null', () => {
      expect(isJSONSerializable(null)).toBe(false);
    });

    it('should return true for primitive types', () => {
      expect(isJSONSerializable('string')).toBe(true);
      expect(isJSONSerializable(123)).toBe(true);
      expect(isJSONSerializable(true)).toBe(true);
    });

    it('should return true for arrays', () => {
      expect(isJSONSerializable([1, 2, 3])).toBe(true);
    });

    it('should return false for non-plain objects', () => {
      expect(isJSONSerializable(new Date())).toBe(false);
      expect(isJSONSerializable(new Map())).toBe(false);
      expect(isJSONSerializable(new Set())).toBe(false);
      expect(isJSONSerializable(new WeakMap())).toBe(false);
      expect(isJSONSerializable(new WeakSet())).toBe(false);
    });

    it('should return false for buffers', () => {
      const buffer = Buffer.from('test');
      expect(isJSONSerializable(buffer)).toBe(false);
    });

    it('should return true for plain objects', () => {
      expect(isJSONSerializable({})).toBe(true);
    });

    it('should return true for objects with toJSON method', () => {
      const obj = {
        toJSON() {
          return { key: 'value' };
        },
      };
      expect(isJSONSerializable(obj)).toBe(true);
    });

    it('should return false for functions', () => {
      const func = function () {};
      expect(isJSONSerializable(func)).toBe(false);
    });

    it('should return false for symbols', () => {
      const symbol = Symbol('test');
      expect(isJSONSerializable(symbol)).toBe(false);
    });

    it('should return false for Map', () => {
      const map = new Map();
      map.set('key', 'value');
      expect(isJSONSerializable(map)).toBe(false);
    });

    it('should return false for Set', () => {
      const set = new Set();
      set.add('value');
      expect(isJSONSerializable(set)).toBe(false);
    });

    it('should return false for Symbols', () => {
      const symbol = Symbol('description');
      expect(isJSONSerializable(symbol)).toBe(false);
    });

    it('should return false for class instances with methods', () => {
      class CustomClass {
        method() {}
      }
      const instance = new CustomClass();
      expect(isJSONSerializable(instance)).toBe(false);
    });
  });

  describe('replaceUrlPathParams()', () => {
    it('should replace a single placeholder with a value from urlPathParams', () => {
      const url = '/users/:userId';
      const params = { userId: 123 };

      const result = replaceUrlPathParams(url, params);

      expect(result).toBe('/users/123');
    });

    it('should replace multiple placeholders with corresponding values from urlPathParams', () => {
      const url = '/users/:userId/posts/:postId';
      const params = { userId: 123, postId: 456 };

      const result = replaceUrlPathParams(url, params);

      expect(result).toBe('/users/123/posts/456');
    });

    it('should leave placeholders unchanged if no corresponding value is provided in urlPathParams', () => {
      const url = '/users/:userId/posts/:postId';
      const params = { userName: 'john' };

      const result = replaceUrlPathParams(url, params);

      expect(result).toBe('/users/:userId/posts/:postId');
    });

    it('should handle placeholders with special characters', () => {
      const url = '/users/:userId/details/:detailId';
      const params = { userId: 123, detailId: 'abc' };

      const result = replaceUrlPathParams(url, params);

      expect(result).toBe('/users/123/details/abc');
    });

    it('should handle empty urlPathParams object', () => {
      const url = '/users/:userId';
      const params = {};

      const result = replaceUrlPathParams(url, params);

      expect(result).toBe('/users/:userId');
    });

    it('should replace placeholders even when URL contains query parameters', () => {
      const url = '/users/:userId?name=:name';
      const params = { userId: 123, name: 'john' };

      const result = replaceUrlPathParams(url, params);

      expect(result).toBe('/users/123?name=john');
    });

    it('should handle URL with no placeholders', () => {
      const url = '/users/123';
      const params = { userId: 456 };

      const result = replaceUrlPathParams(url, params);

      expect(result).toBe('/users/123');
    });

    it('should handle nested placeholders correctly', () => {
      const url = '/users/:userId/posts/:postId/details/:detailId';
      const params = { userId: 123, postId: 456, detailId: 'abc' };

      const result = replaceUrlPathParams(url, params);

      expect(result).toBe('/users/123/posts/456/details/abc');
    });

    it('should replace conflicting placeholders with corresponding values', () => {
      const url = '/items/:itemId/details/:itemId';
      const params = { itemId: 'value1' };

      const result = replaceUrlPathParams(url, params);

      expect(result).toBe('/items/value1/details/value1');
    });
  });

  describe('appendQueryParams()', () => {
    it('should append single query parameter to URL without existing query string', () => {
      const url = 'https://api.example.com/resource';
      const params = { foo: 'bar' };
      const result = appendQueryParams(url, params);
      expect(result).toBe('https://api.example.com/resource?foo=bar');
    });

    it('should append multiple query parameters to URL without existing query string', () => {
      const url = 'https://api.example.com/resource';
      const params = { foo: 'bar', baz: 'qux' };
      const result = appendQueryParams(url, params);
      expect(result).toBe('https://api.example.com/resource?foo=bar&baz=qux');
    });

    it('should append array query parameters correctly', () => {
      const url = 'https://api.example.com/resource';
      const params = { foo: [1, 2], bar: 'baz' };
      const result = appendQueryParams(url, params);
      expect(result).toBe(
        'https://api.example.com/resource?foo[]=1&foo[]=2&bar=baz',
      );
    });

    it('should append parameters to URL with existing query string', () => {
      const url = 'https://api.example.com/resource?existing=param';
      const params = { foo: 'bar' };
      const result = appendQueryParams(url, params);
      expect(result).toBe(
        'https://api.example.com/resource?existing=param&foo=bar',
      );
    });

    it('should handle special characters in query parameters', () => {
      const url = 'https://api.example.com/resource';
      const params = { 'special key': 'special value' };
      const result = appendQueryParams(url, params);
      expect(result).toBe(
        'https://api.example.com/resource?special%20key=special%20value',
      );
    });

    it('should return the original URL if no params are provided', () => {
      const url = 'https://api.example.com/resource';
      const params = {};
      const result = appendQueryParams(url, params);
      expect(result).toBe('https://api.example.com/resource');
    });

    it('should handle appending array parameters to URL with existing query string', () => {
      const url = 'https://api.example.com/resource?existing=param';
      const params = { foo: [1, 2], bar: 'baz' };
      const result = appendQueryParams(url, params);
      expect(result).toBe(
        'https://api.example.com/resource?existing=param&foo[]=1&foo[]=2&bar=baz',
      );
    });

    it('should encode special characters in query parameters', () => {
      const url = 'https://api.example.com/resource';
      const params = { 'special key!@#': 'special value$%^' };
      const result = appendQueryParams(url, params);
      expect(result).toBe(
        'https://api.example.com/resource?special%20key!%40%23=special%20value%24%25%5E',
      );
    });

    it('should handle numeric keys correctly', () => {
      const url = 'https://api.example.com/resource';
      const params = { 123: 'numeric' };
      const result = appendQueryParams(url, params);
      expect(result).toBe('https://api.example.com/resource?123=numeric');
    });

    it('should handle URL with no query parameters and special characters in values', () => {
      const url = 'https://api.example.com/resource';
      const params = {
        'special value': 'value with special characters !@#$%^&*()',
      };
      const result = appendQueryParams(url, params);
      expect(result).toBe(
        'https://api.example.com/resource?special%20value=value%20with%20special%20characters%20!%40%23%24%25%5E%26*()',
      );
    });

    it('should handle parameters with different types of values', () => {
      const url = 'https://api.example.com/resource';
      const params = {
        string: 'string',
        number: 123,
        boolean: true,
        array: [1, 2],
      };
      const result = appendQueryParams(url, params);
      expect(result).toBe(
        'https://api.example.com/resource?string=string&number=123&boolean=true&array[]=1&array[]=2',
      );
    });

    it('should handle params as an instance of URLSearchParams', () => {
      const url = 'https://api.example.com/resource';
      const params = new URLSearchParams();
      params.append('foo', 'bar');
      params.append('baz', 'qux');
      const result = appendQueryParams(url, params);
      expect(result).toBe('https://api.example.com/resource?foo=bar&baz=qux');
    });

    it('should handle params as an instance of URLSearchParams for url with existing query params', () => {
      const url = 'https://api.example.com/resource?biz=due';
      const params = new URLSearchParams();
      params.append('foo', 'bar');
      params.append('baz', 'qux');
      const result = appendQueryParams(url, params);
      expect(result).toBe(
        'https://api.example.com/resource?biz=due&foo=bar&baz=qux',
      );
    });

    it('should not append question mark when params are empty and instance of URLSearchParams is parsed', () => {
      const url = 'https://api.example.com/resource';
      const params = new URLSearchParams();
      const result = appendQueryParams(url, params);
      expect(result).toBe(url);
    });

    it('should handle complex nested parameters', () => {
      const url = 'https://api.example.com/resource';
      const params = { nested: { foo: 'bar', baz: [1, 2] } };
      const result = appendQueryParams(url, params);
      expect(result).toBe(
        'https://api.example.com/resource?nested%5Bfoo%5D=bar&nested%5Bbaz%5D[]=1&nested%5Bbaz%5D[]=2',
      );
    });

    it('should handle array of objects with params', () => {
      const url = 'https://api.example.com/resource';
      const params = [
        { name: 'username', value: 'john_doe' },
        { name: 'password', value: 'secure123' },
      ];
      const result = appendQueryParams(url, params);

      expect(result).toBe(
        'https://api.example.com/resource?username=john_doe&password=secure123',
      );
    });

    it('should return the same url if empty array is propagated', () => {
      const url = 'https://api.example.com/resource';
      const params: [] = [];
      const result = appendQueryParams(url, params);

      expect(result).toBe(url);
    });

    it('should return the same url if null is propagated', () => {
      const url = 'https://api.example.com/resource';
      const params = null;
      const result = appendQueryParams(url, params);

      expect(result).toBe(url);
    });
  });

  describe('delayInvocation()', () => {
    // Set up fake timers before all tests
    beforeAll(() => {
      jest.useFakeTimers();
    });

    // Clean up fake timers after all tests
    afterAll(() => {
      jest.useRealTimers();
    });

    it('should resolve after the specified delay', async () => {
      const delay = 100; // 100 milliseconds

      // Call the function but don't wait yet
      const promise = delayInvocation(delay);

      // Fast-forward time by 100 milliseconds
      jest.advanceTimersByTime(delay);

      // Await the promise and check the result
      const result = await promise;
      expect(result).toBe(true);
    });

    it('should resolve with true', async () => {
      const promise = delayInvocation(100);

      // Fast-forward time by 100 milliseconds
      jest.advanceTimersByTime(100);

      // Await the promise and check the result
      const result = await promise;
      expect(result).toBe(true);
    });

    it('should resolve immediately for zero delay', async () => {
      const promise = delayInvocation(0);

      // Fast-forward time by 0 milliseconds (immediate resolve)
      jest.advanceTimersByTime(0);

      // Await the promise and check the result
      const result = await promise;
      expect(result).toBe(true);
    });
  });

  describe('processHeaders()', () => {
    it('should return an empty object if headers are null or undefined', () => {
      const result = processHeaders(null);
      expect(result).toEqual({});

      const resultUndefined = processHeaders(undefined);
      expect(resultUndefined).toEqual({});
    });

    it('should convert Headers object to a plain object', () => {
      const headers = new Headers();
      headers.append('Content-Type', 'application/json');
      headers.append('Authorization', 'Bearer token');

      const result = processHeaders(headers);

      expect(result).toEqual({
        'content-type': 'application/json',
        authorization: 'Bearer token',
      });
    });

    it('should handle plain object headers', () => {
      const result = processHeaders({
        'Content-Type': 'application/json',
        Authorization: 'Bearer token',
      });

      expect(result).toEqual({
        'content-type': 'application/json',
        authorization: 'Bearer token',
      });
    });

    it('should handle an empty Headers object', () => {
      const headers = new Headers(); // Empty Headers
      const result = processHeaders(headers);

      expect(result).toEqual({});
    });
  });
});

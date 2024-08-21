import {
  isJSONSerializable,
  replaceUrlPathParams,
  appendQueryParams,
} from '../src/utils';

jest.mock('../src/interceptor-manager', () => ({
  interceptRequest: jest.fn().mockImplementation(async (config) => config),
  interceptResponse: jest.fn().mockImplementation(async (response) => response),
}));

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
  });
});

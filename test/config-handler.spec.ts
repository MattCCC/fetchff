import { buildConfig } from '../src/config-handler';
import { GET, CONTENT_TYPE } from '../src/constants';

describe('buildConfig() with native fetch()', () => {
  const contentTypeValue = 'application/json;charset=utf-8';
  const headers = {
    Accept: 'application/json, text/plain, */*',
    'Accept-Encoding': 'gzip, deflate, br',
    'Content-Type': contentTypeValue,
  };

  it('should not differ when the same request is made', () => {
    const result = buildConfig('https://example.com/api', {
      method: 'GET',
      data: { foo: 'bar' },
      baseURL: 'abc',
    });

    const result2 = buildConfig('https://example.com/api', {
      method: 'GET',
      data: { foo: 'bar' },
      baseURL: 'abc',
    });

    expect(result).toEqual(result2);
  });

  it('should handle GET requests correctly', () => {
    const result = buildConfig('https://example.com/api', {
      method: 'GET',
      headers,
      params: { foo: 'bar' },
    });

    expect(result).toMatchObject({
      url: 'https://example.com/api?foo=bar',
      method: 'GET',
      headers,
    });
  });

  it('should handle POST requests correctly', () => {
    const result = buildConfig('https://example.com/api', {
      method: 'POST',
      data: { foo: 'bar' },
      headers,
    });

    expect(result).toMatchObject({
      url: 'https://example.com/api',
      method: 'POST',
      headers,
      body: JSON.stringify({ foo: 'bar' }),
    });
  });

  it('should handle PUT requests correctly', () => {
    const result = buildConfig('https://example.com/api', {
      method: 'PUT',
      data: { foo: 'bar' },
      headers,
    });

    expect(result).toMatchObject({
      url: 'https://example.com/api',
      method: 'PUT',
      headers,
      body: JSON.stringify({ foo: 'bar' }),
    });
  });

  it('should handle DELETE requests correctly', () => {
    const result = buildConfig('https://example.com/api', {
      method: 'DELETE',
      data: { foo: 'bar' },
      headers,
    });

    expect(result).toMatchObject({
      url: 'https://example.com/api',
      method: 'DELETE',
      headers,
      body: JSON.stringify({ foo: 'bar' }),
    });
  });

  it('should handle custom headers and config when both data and query params are passed', () => {
    const mergedConfig = {
      headers,
    };

    mergedConfig.headers = {
      ...mergedConfig.headers,
      ...{ 'X-CustomHeader': 'Some token' },
    };

    const result = buildConfig('https://example.com/api', {
      ...mergedConfig,
      method: 'POST',
      data: { additional: 'info' },
      params: { foo: 'bar' },
    });

    expect(result).toMatchObject({
      url: 'https://example.com/api?foo=bar',
      method: 'POST',
      headers: {
        ...headers,
        'X-CustomHeader': 'Some token',
      },
      body: JSON.stringify({ additional: 'info' }),
    });
  });

  it('should handle empty data and config', () => {
    const result = buildConfig('https://example.com/api', {
      method: 'POST',
      data: null,
    });

    expect(result).toMatchObject({
      url: 'https://example.com/api',
      method: 'POST',
      body: null,
    });
  });

  it('should handle data as string', () => {
    const result = buildConfig('https://example.com/api', {
      method: 'POST',
      data: 'rawData',
    });

    expect(result).toMatchObject({
      url: 'https://example.com/api',
      method: 'POST',
      body: 'rawData',
    });
  });

  it('should correctly append query params for GET-alike methods', () => {
    const result = buildConfig('https://example.com/api', {
      method: 'HEAD',
      params: { foo: [1, 2] },
    });

    expect(result).toMatchObject({
      url: 'https://example.com/api?foo[]=1&foo[]=2',
      method: 'HEAD',
    });
  });

  it('should handle POST with query params in config', () => {
    const result = buildConfig('https://example.com/api', {
      method: 'POST',
      data: { additional: 'info' },
      params: { foo: 'bar' },
    });

    expect(result).toMatchObject({
      url: 'https://example.com/api?foo=bar',
      method: 'POST',
      body: JSON.stringify({ additional: 'info' }),
    });
  });

  it('should append credentials if flag is used', () => {
    const result = buildConfig('https://example.com/api', {
      method: 'POST',
      data: null,
      withCredentials: true,
    });

    expect(result).toMatchObject({
      url: 'https://example.com/api',
      method: 'POST',
      credentials: 'include',
      body: null,
    });
  });

  it('should not append query params to POST requests if body is set as data', () => {
    const result = buildConfig('https://example.com/api', {
      method: 'POST',
      data: { foo: 'bar' },
    });

    expect(result).toMatchObject({
      url: 'https://example.com/api',
      method: 'POST',
      body: JSON.stringify({ foo: 'bar' }),
    });
  });

  it('should not append body nor data to GET requests', () => {
    const result = buildConfig('https://example.com/api', {
      method: 'GET',
      data: { foo: 'bar' },
      body: { additional: 'info' },
      params: { foo: 'bar' },
    });

    expect(result).toMatchObject({
      url: 'https://example.com/api?foo=bar',
      method: 'GET',
      params: { foo: 'bar' },
    });
  });
});

describe('request() Content-Type', () => {
  const apiUrl = 'http://example.com/api/';
  const contentTypeValue = 'application/json;charset=utf-8';

  afterEach(() => {
    jest.clearAllMocks();
  });

  const headers = {
    Accept: 'application/json, text/plain, */*',
    'Accept-Encoding': 'gzip, deflate, br',
  };

  describe.each([
    { method: 'DELETE', body: undefined, expectContentType: false },
    { method: 'PUT', body: undefined, expectContentType: false },
    { method: 'DELETE', body: { foo: 'bar' }, expectContentType: true },
    { method: 'PUT', body: { foo: 'bar' }, expectContentType: true },
    { method: 'POST', body: undefined, expectContentType: true },
    { method: GET, body: undefined, expectContentType: true },
  ])(
    '$method request with body: $body',
    ({ method, body, expectContentType }) => {
      it(
        expectContentType
          ? 'should set Content-Type when body is provided or method requires it'
          : 'should not set Content-Type when no body is provided for DELETE or PUT',
        () => {
          const result = buildConfig(apiUrl, {
            method,
            body,
            headers,
          });
          if (expectContentType) {
            expect(result.headers).toHaveProperty(
              CONTENT_TYPE,
              contentTypeValue,
            );
          } else {
            expect(result.headers).not.toHaveProperty(CONTENT_TYPE);
          }
        },
      );
    },
  );

  describe.each(['DELETE', 'PUT'])(
    '%s method with custom Content-Type',
    (method) => {
      it(`should keep custom Content-Type for ${method} method`, () => {
        const customContentType = 'application/x-www-form-urlencoded';
        const result = buildConfig(apiUrl, {
          method,
          headers: { 'Content-Type': customContentType },
        });
        expect(result.headers).toHaveProperty(
          'Content-Type',
          customContentType,
        );
      });
    },
  );
});

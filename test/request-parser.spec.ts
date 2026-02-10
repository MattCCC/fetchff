import { parseResponseData, prepareResponse } from '../src/response-parser';
import type {
  FetchResponse,
  RequestConfig,
} from '../src/types/request-handler';

describe('parseData()', () => {
  let mockResponse: FetchResponse;

  beforeEach(() => {
    mockResponse = {
      headers: {
        get: jest.fn(),
      },
      clone: jest.fn(),
      json: jest.fn(),
      formData: jest.fn(),
      blob: jest.fn(),
      text: jest.fn(),
      body: 'something',
    } as unknown as FetchResponse;
  });

  it('should parse JSON response when Content-Type is application/json', async () => {
    (mockResponse.headers.get as jest.Mock).mockReturnValue('application/json');
    const expectedData = { key: 'value' };
    (mockResponse.json as jest.Mock).mockResolvedValue(expectedData);

    const data = await parseResponseData(mockResponse);
    expect(data).toEqual(expectedData);
  });

  it('should parse JSON response when Content-Type is application/vnd.api+json', async () => {
    (mockResponse.headers.get as jest.Mock).mockReturnValue(
      'application/vnd.api+json',
    );
    const expectedData = { key: 'value' };
    (mockResponse.json as jest.Mock).mockResolvedValue(expectedData);

    const data = await parseResponseData(mockResponse);
    expect(data).toEqual(expectedData);
  });

  it('should parse FormData when Content-Type is multipart/form-data', async () => {
    (mockResponse.headers.get as jest.Mock).mockReturnValue(
      'multipart/form-data',
    );
    const expectedData = new FormData();
    (mockResponse.formData as jest.Mock).mockResolvedValue(expectedData);

    const data = await parseResponseData(mockResponse);
    expect(data).toEqual(expectedData);
  });

  it('should parse Blob when Content-Type is application/octet-stream', async () => {
    (mockResponse.headers.get as jest.Mock).mockReturnValue(
      'application/octet-stream',
    );
    const expectedData = new Blob(['test']);
    (mockResponse.blob as jest.Mock).mockResolvedValue(expectedData);

    const data = await parseResponseData(mockResponse);
    expect(data).toEqual(expectedData);
  });

  it('should parse FormData when Content-Type is application/x-www-form-urlencoded', async () => {
    (mockResponse.headers.get as jest.Mock).mockReturnValue(
      'application/x-www-form-urlencoded',
    );
    const expectedData = new FormData();
    (mockResponse.formData as jest.Mock).mockResolvedValue(expectedData);

    const data = await parseResponseData(mockResponse);
    expect(data).toEqual(expectedData);
  });

  it('should parse text when Content-Type is text/plain', async () => {
    (mockResponse.headers.get as jest.Mock).mockReturnValue('text/plain');
    const expectedData = 'Some plain text';
    (mockResponse.text as jest.Mock).mockResolvedValue(expectedData);

    const data = await parseResponseData(mockResponse);
    expect(data).toEqual(expectedData);
  });

  it('should return plain text when Content-Type is missing and JSON parsing fails', async () => {
    (mockResponse.headers.get as jest.Mock).mockReturnValue('');
    const responseClone = {
      json: jest.fn().mockRejectedValue(new Error('JSON parsing error')),
    };
    (mockResponse.clone as jest.Mock).mockReturnValue(responseClone);

    const expectedData = 'Some plain text';
    (mockResponse.text as jest.Mock).mockResolvedValue(expectedData);

    const data = await parseResponseData(mockResponse);

    expect(data).toBe('Some plain text');
  });

  it('should return null when content type is not recognized and response parsing fails', async () => {
    (mockResponse.headers.get as jest.Mock).mockReturnValue(
      'application/unknown-type',
    );
    (mockResponse.text as jest.Mock).mockRejectedValue(
      new Error('Text parsing error'),
    );

    const data = await parseResponseData(mockResponse);
    expect(data).toBeNull();
  });

  it('should handle streams and return body or data when Content-Type is not recognized', async () => {
    (mockResponse.headers.get as jest.Mock).mockReturnValue(
      'application/unknown-type',
    );

    // Mock the `text` method to simulate stream content
    const streamContent = 'stream content';
    (mockResponse.text as jest.Mock).mockResolvedValue(streamContent);

    const data = await parseResponseData(mockResponse);
    expect(data).toEqual(streamContent);
  });

  it('should return null for null response', async () => {
    const data = await parseResponseData(null as any);
    expect(data).toBeNull();
  });

  it('should auto-parse JSON-like text when content type is missing', async () => {
    (mockResponse.headers.get as jest.Mock).mockReturnValue('');
    (mockResponse.text as jest.Mock).mockResolvedValue('{"key":"value"}');

    const data = await parseResponseData(mockResponse);
    expect(data).toEqual({ key: 'value' });
  });

  it('should auto-parse JSON array text when content type is missing', async () => {
    (mockResponse.headers.get as jest.Mock).mockReturnValue('');
    (mockResponse.text as jest.Mock).mockResolvedValue('[1,2,3]');

    const data = await parseResponseData(mockResponse);
    expect(data).toEqual([1, 2, 3]);
  });
});

describe('prepareResponse()', () => {
  const baseConfig: RequestConfig = {
    method: 'GET',
    url: '/test',
    cacheKey: 'test-key',
  };

  it('should return error response when response is null', () => {
    const result = prepareResponse(null, baseConfig);

    expect(result.ok).toBe(false);
    expect(result.data).toBeNull();
    expect(result.isFetching).toBe(false);
    expect(result.isSuccess).toBe(false);
    expect(result.isError).toBe(true);
    expect(result.headers).toBeNull();
    expect(typeof result.mutate).toBe('function');
  });

  it('should use defaultResponse when response is null and defaultResponse is set', () => {
    const config = { ...baseConfig, defaultResponse: { fallback: true } };
    const result = prepareResponse(null, config);

    expect(result.data).toEqual({ fallback: true });
  });

  it('should apply flattenResponse when enabled', () => {
    const response = {
      data: { data: 'nested-value' },
      ok: true,
      headers: {},
    } as unknown as FetchResponse;
    const config = { ...baseConfig, flattenResponse: true };

    const result = prepareResponse(response, config);

    expect(result.data).toBe('nested-value');
  });

  it('should apply select function when provided', () => {
    const response = {
      data: { items: [1, 2, 3], total: 3 },
      ok: true,
      headers: {},
    } as unknown as FetchResponse;
    const config = {
      ...baseConfig,
      select: (data: any) => data.items,
    };

    const result = prepareResponse(response, config);

    expect(result.data).toEqual([1, 2, 3]);
  });

  it('should handle custom fetcher response (non-native Response)', () => {
    const response = {
      data: { id: 1 },
      ok: true,
      headers: {},
    } as unknown as FetchResponse;

    const result = prepareResponse(response, baseConfig);

    expect(result.isFetching).toBe(false);
    expect(result.isSuccess).toBe(true);
    expect(result.isError).toBe(false);
    expect(typeof result.mutate).toBe('function');
  });

  it('should set defaultResponse when data is empty object', () => {
    const response = {
      data: {},
      ok: true,
      headers: {},
    } as unknown as FetchResponse;
    const config = { ...baseConfig, defaultResponse: [] };

    const result = prepareResponse(response, config);

    expect(result.data).toEqual([]);
  });
});

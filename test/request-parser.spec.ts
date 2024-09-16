import { parseResponseData } from '../src/response-parser';
import type { FetchResponse } from '../src/types/request-handler';

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
});

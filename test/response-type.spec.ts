import { createApiFetcher, fetchf } from '../src';
import { pruneCache } from '../src/cache-manager';
import { clearAllTimeouts } from '../src/timeout-wheel';

const url = 'https://api.example.com/books';
const json = '{"title":"Dune"}';

describe('responseType', () => {
  const mockResponse = (
    body: string | null,
    contentType: string,
    status = 200,
  ) => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(body, {
          status,
          headers: { 'Content-Type': contentType },
        }),
    );
  };

  afterEach(() => {
    jest.restoreAllMocks();
    pruneCache();
    clearAllTimeouts();
  });

  it('should parse the body according to its content type by default', async () => {
    mockResponse(json, 'application/json');

    const { data } = await fetchf(url);

    expect(data).toEqual({ title: 'Dune' });
  });

  it('should read JSON regardless of the content type', async () => {
    mockResponse(json, 'text/plain; charset=utf-8');

    const { data } = await fetchf(url, { responseType: 'json' });

    expect(data).toEqual({ title: 'Dune' });
  });

  it('should read the body as text', async () => {
    mockResponse(json, 'application/json');

    const { data } = await fetchf(url, { responseType: 'text' });

    expect(data).toBe(json);
  });

  it('should read the body as a Blob', async () => {
    mockResponse('%PDF-1.7', 'application/pdf');

    const { data } = await fetchf(url, { responseType: 'blob' });

    expect(data).toBeInstanceOf(Blob);
    expect(data.type).toBe('application/pdf');
    await expect(data.text()).resolves.toBe('%PDF-1.7');
  });

  it('should read the body as an ArrayBuffer', async () => {
    mockResponse(json, 'application/json');

    const { data } = await fetchf(url, { responseType: 'arrayBuffer' });

    expect(data).toBeInstanceOf(ArrayBuffer);
    expect(new TextDecoder().decode(data)).toBe(json);
  });

  it('should read the body as FormData', async () => {
    mockResponse(
      'title=Dune&author=Herbert',
      'application/x-www-form-urlencoded',
    );

    const { data } = await fetchf(url, { responseType: 'formData' });

    expect(data).toBeInstanceOf(FormData);
    expect(data.get('author')).toBe('Herbert');
  });

  it('should leave the body unread as a stream', async () => {
    mockResponse(json, 'application/json');

    const response = await fetchf(url, { responseType: 'stream' });

    expect(response.data).toBeInstanceOf(ReadableStream);
    expect(response.bodyUsed).toBe(false);
    await expect(new Response(response.data).text()).resolves.toBe(json);
  });

  it('should return null when the body cannot be read as requested', async () => {
    mockResponse('<html></html>', 'text/html');

    const { data, error } = await fetchf(url, { responseType: 'json' });

    expect(data).toBeNull();
    expect(error).toBeNull();
  });

  it('should read error responses as requested too', async () => {
    mockResponse(json, 'application/json', 404);

    const { error } = await fetchf(url, {
      responseType: 'text',
      strategy: 'softFail',
    });

    expect(error!.status).toBe(404);
    expect(error!.response!.data).toBe(json);
  });

  it('should prefer a custom parser', async () => {
    mockResponse(json, 'application/json');

    const { data } = await fetchf(url, {
      responseType: 'blob',
      parser: (response) => response.text(),
    });

    expect(data).toBe(json);
  });

  it('should be set per endpoint', async () => {
    mockResponse('%PDF-1.7', 'application/json');

    const api = createApiFetcher({
      baseURL: 'https://api.example.com',
      endpoints: { getReport: { url: '/report', responseType: 'text' } },
    });

    const { data } = await api.getReport();

    expect(data).toBe('%PDF-1.7');
  });

  it('should keep Blobs, buffers and streams in place of a defaultResponse', async () => {
    mockResponse('%PDF-1.7', 'application/pdf');

    const { data: blob } = await fetchf(url, {
      responseType: 'blob',
      defaultResponse: {},
    });
    const { data: buffer } = await fetchf(url, { defaultResponse: {} });
    const { data: stream } = await fetchf(url, {
      responseType: 'stream',
      defaultResponse: {},
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(buffer).toBeInstanceOf(ArrayBuffer);
    expect(stream).toBeInstanceOf(ReadableStream);
  });

  it('should still replace empty objects and arrays with the defaultResponse', async () => {
    const defaultResponse = { books: [] };

    mockResponse('{}', 'application/json');
    const { data: emptyObject } = await fetchf(url, { defaultResponse });

    mockResponse('[]', 'application/json');
    const { data: emptyArray } = await fetchf(url, { defaultResponse });

    expect(emptyObject).toBe(defaultResponse);
    expect(emptyArray).toBe(defaultResponse);
  });
});

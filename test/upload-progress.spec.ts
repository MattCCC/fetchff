import { abortRequest, fetchf } from '../src';
import type { UploadProgress } from '../src';
import { pruneCache } from '../src/cache-manager';
import { clearAllTimeouts } from '../src/timeout-wheel';

const url = 'https://api.example.com/upload';

type ProgressHandler = (event: {
  loaded: number;
  total: number;
  lengthComputable: boolean;
}) => void;

// A minimal XMLHttpRequest, as found in browsers and React Native
class MockXMLHttpRequest {
  static last: MockXMLHttpRequest;

  upload: { onprogress: ProgressHandler | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  responseType = '';
  withCredentials = false;
  method = '';
  url = '';
  requestHeaders: Record<string, string> = {};
  body: unknown;
  status = 0;
  statusText = '';
  response: Blob | null = null;
  responseURL = '';
  responseHeaders = '';
  abort = jest.fn(() => this.onabort?.());

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name: string, value: string) {
    this.requestHeaders[name] = value;
  }

  getAllResponseHeaders() {
    return this.responseHeaders;
  }

  send(body: unknown) {
    this.body = body;
    MockXMLHttpRequest.last = this;
  }

  respond(status: number, body: string | null, headers = '') {
    this.status = status;
    this.statusText = status === 200 ? 'OK' : 'Error';
    this.response = body === null ? null : new Blob([body]);
    this.responseURL = this.url;
    this.responseHeaders = headers;
    this.onload?.();
  }
}

const jsonHeaders = 'content-type: application/json\r\nx-request-id: 7\r\n';

// Lets pending promises settle, e.g. until the request is sent
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('onUploadProgress', () => {
  afterEach(() => {
    pruneCache();
    clearAllTimeouts();
    jest.useRealTimers();
  });

  describe('with XMLHttpRequest (browsers and React Native)', () => {
    beforeEach(() => {
      (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest =
        MockXMLHttpRequest;
      global.fetch = jest.fn();
    });

    afterEach(() => {
      delete (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest;
    });

    it('should send the request and report the upload progress', async () => {
      const progress: UploadProgress[] = [];
      const promise = fetchf(url, {
        method: 'POST',
        body: { name: 'photo.jpg' },
        withCredentials: true,
        // Browsers don't let requests set headers like these, so they are skipped
        headers: {
          'X-Tenant-Id': 'acme',
          'Proxy-Authorization': 'Basic abc',
          'Sec-Fetch-Mode': 'cors',
          Te: 'trailers',
        },
        onUploadProgress: (event) => progress.push(event),
      });

      await flush();
      const xhr = MockXMLHttpRequest.last;

      expect(global.fetch).not.toHaveBeenCalled();
      expect(xhr.method).toBe('POST');
      expect(xhr.url).toBe(url);
      expect(xhr.body).toBe('{"name":"photo.jpg"}');
      expect(xhr.withCredentials).toBe(true);
      expect(xhr.responseType).toBe('blob');
      expect(xhr.requestHeaders).toEqual({
        accept: 'application/json, text/plain, */*',
        'content-type': 'application/json;charset=utf-8',
        'x-tenant-id': 'acme',
      });

      xhr.upload.onprogress!({ loaded: 5, total: 20, lengthComputable: true });
      xhr.upload.onprogress!({ loaded: 20, total: 20, lengthComputable: true });
      xhr.upload.onprogress!({ loaded: 30, total: 0, lengthComputable: false });
      xhr.respond(200, '{"id":1}', jsonHeaders);

      const response = await promise;

      expect(progress).toEqual([
        { loaded: 5, total: 20, progress: 0.25 },
        { loaded: 20, total: 20, progress: 1 },
        { loaded: 30, total: undefined, progress: undefined },
      ]);
      expect(response.data).toEqual({ id: 1 });
      expect(response.status).toBe(200);
      expect(response.statusText).toBe('OK');
      expect(response.url).toBe(url);
      expect(response.headers).toEqual({
        'content-type': 'application/json',
        'x-request-id': '7',
      });
    });

    it('should handle responses without a body', async () => {
      const promise = fetchf(url, {
        method: 'PUT',
        body: 'file contents',
        onUploadProgress: jest.fn(),
      });

      await flush();
      MockXMLHttpRequest.last.respond(204, 'ignored');

      const response = await promise;

      expect(response.status).toBe(204);
      expect(response.error).toBeNull();
    });

    it('should reject with a response error on error statuses', async () => {
      const promise = fetchf(url, {
        method: 'POST',
        body: 'file contents',
        strategy: 'softFail',
        onUploadProgress: jest.fn(),
      });

      await flush();
      MockXMLHttpRequest.last.respond(
        413,
        '{"message":"Too large"}',
        jsonHeaders,
      );

      const { error, data } = await promise;

      expect(error?.status).toBe(413);
      expect(data).toEqual({ message: 'Too large' });
    });

    it('should reject on network errors', async () => {
      const promise = fetchf(url, {
        method: 'POST',
        body: 'file contents',
        strategy: 'softFail',
        onUploadProgress: jest.fn(),
      });

      await flush();
      MockXMLHttpRequest.last.onerror!();

      const { error } = await promise;

      expect(error?.message).toBe('Network request failed');
    });

    it('should reject if the response is invalid', async () => {
      const promise = fetchf(url, {
        method: 'POST',
        body: 'file contents',
        strategy: 'softFail',
        onUploadProgress: jest.fn(),
      });

      await flush();
      MockXMLHttpRequest.last.respond(0, null);

      const { error } = await promise;

      // Responses can't have status 0
      expect(error?.name).toBe('RangeError');
    });

    it('should abort the upload when the request times out', async () => {
      jest.useFakeTimers();

      const promise = fetchf(url, {
        method: 'POST',
        body: 'file contents',
        timeout: 1000,
        strategy: 'softFail',
        onUploadProgress: jest.fn(),
      });

      await jest.advanceTimersByTimeAsync(0);
      const xhr = MockXMLHttpRequest.last;

      await jest.advanceTimersByTimeAsync(2000);
      const { error } = await promise;

      expect(xhr.abort).toHaveBeenCalled();
      expect(error?.name).toBe('TimeoutError');
    });

    it('should not send the upload if the request was aborted before', async () => {
      const onUploadProgress = jest.fn();
      const { error } = await fetchf(url, {
        method: 'POST',
        body: 'file contents',
        cacheKey: 'upload',
        strategy: 'softFail',
        onRequest: () => {
          abortRequest('upload', new Error('Cancelled by the user'));
        },
        onUploadProgress,
      });

      expect(error?.message).toBe('Cancelled by the user');
      expect(onUploadProgress).not.toHaveBeenCalled();
    });

    it('should reject with an abort error if the abort reason is unknown', async () => {
      const promise = fetchf(url, {
        method: 'POST',
        body: 'file contents',
        strategy: 'softFail',
        onUploadProgress: jest.fn(),
      });

      await flush();
      MockXMLHttpRequest.last.onabort!();

      const { error } = await promise;

      expect(error?.name).toBe('AbortError');
    });

    it('should stream bodies that are streams with fetch()', async () => {
      global.fetch = jest.fn(
        async (_url, init?: RequestInit) =>
          new Response(await new Response(init?.body).text()),
      );

      const { data } = await fetchf(url, {
        method: 'POST',
        body: new Blob(['streamed']).stream(),
        onUploadProgress: jest.fn(),
      });

      expect(data).toBe('streamed');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('with streamed fetch() (e.g. Node.js)', () => {
    let fetchMock: jest.Mock;
    let received: { body: string; headers: Headers; init: RequestInit };

    beforeEach(() => {
      fetchMock = jest.fn(async (_url, init: RequestInit) => {
        // Like fetch(), read the streamed body while sending it
        received = {
          body: await new Response(init.body).text(),
          headers: new Headers(init.headers),
          init,
        };

        return new Response('{"ok":true}', {
          headers: { 'Content-Type': 'application/json' },
        });
      });
      global.fetch = fetchMock;
    });

    it('should report the upload progress while streaming the body', async () => {
      const progress: UploadProgress[] = [];
      // A file of several parts, which is read in several chunks
      const file = new Blob(
        ['a'.repeat(70000), 'b'.repeat(70000), 'c'.repeat(60000)],
        { type: 'image/png' },
      );

      const { data } = await fetchf(url, {
        method: 'POST',
        body: file,
        onUploadProgress: (event) => progress.push(event),
      });

      expect(data).toEqual({ ok: true });
      expect(received.body).toHaveLength(200000);
      expect(received.headers.get('content-type')).toBe('image/png');
      expect((received.init as { duplex?: string }).duplex).toBe('half');
      expect(progress.length).toBeGreaterThan(1);
      expect(progress[progress.length - 1]).toEqual({
        loaded: 200000,
        total: 200000,
        progress: 1,
      });

      // The progress only ever increases
      for (let i = 1; i < progress.length; i++) {
        expect(progress[i].loaded).toBeGreaterThan(progress[i - 1].loaded);
      }
    });

    it('should keep the content type of JSON bodies', async () => {
      const onUploadProgress = jest.fn();

      await fetchf(url, {
        method: 'POST',
        body: { name: 'photo.jpg' },
        onUploadProgress,
      });

      expect(received.body).toBe('{"name":"photo.jpg"}');
      expect(received.headers.get('content-type')).toBe(
        'application/json;charset=utf-8',
      );
      expect(onUploadProgress).toHaveBeenLastCalledWith({
        loaded: 20,
        total: 20,
        progress: 1,
      });
    });

    it('should send form data with its multipart content type', async () => {
      const form = new FormData();
      form.append('file', new Blob(['contents']), 'notes.txt');

      await fetchf(url, {
        method: 'POST',
        body: form,
        onUploadProgress: jest.fn(),
      });

      const contentType = received.headers.get('content-type')!;
      const boundary = contentType.split('boundary=')[1];

      expect(contentType).toMatch(/^multipart\/form-data; ?boundary=/);
      expect(received.body).toContain(boundary);
      expect(received.body).toContain('filename="notes.txt"');
      expect(received.body).toContain('contents');
    });

    it('should report the upload progress of streams without a total', async () => {
      const progress: UploadProgress[] = [];

      await fetchf(url, {
        method: 'POST',
        body: new Blob(['streamed']).stream(),
        onUploadProgress: (event) => progress.push(event),
      });

      expect(received.body).toBe('streamed');
      expect(progress).toEqual([
        { loaded: 8, total: undefined, progress: undefined },
      ]);
    });

    it('should use fetch() as usual for requests without a body', async () => {
      const onUploadProgress = jest.fn();

      await fetchf(url, { onUploadProgress });

      expect(received.init.body).toBeUndefined();
      expect((received.init as { duplex?: string }).duplex).toBeUndefined();
      expect(onUploadProgress).not.toHaveBeenCalled();
    });

    it('should leave uploads to custom fetchers', async () => {
      const fetcher = jest.fn(async () => ({ data: 'uploaded' }));
      const onUploadProgress = jest.fn();

      await fetchf(url, {
        method: 'POST',
        body: 'file contents',
        fetcher,
        onUploadProgress,
      });

      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(onUploadProgress).not.toHaveBeenCalled();
    });
  });
});

/* eslint-disable @typescript-eslint/no-explicit-any */
import { mutate } from './cache-manager';
import {
  APPLICATION_CONTENT_TYPE,
  APPLICATION_JSON,
  CONTENT_TYPE,
  FUNCTION,
  STRING,
} from './constants';
import {
  DefaultResponse,
  FetchResponse,
  RequestConfig,
  ResponseError,
  DefaultParams,
  DefaultUrlParams,
  DefaultPayload,
} from './types';
import { flattenData, isObject, processHeaders } from './utils';

/**
 * Parses the response data based on the Content-Type header, or reads it as the given response type.
 *
 * @param response - The Response object to parse.
 * @param responseType - How to read the body regardless of its Content-Type, e.g. as a Blob, or `'stream'` to leave it unread.
 * @returns A Promise that resolves to the parsed data.
 */
export async function parseResponseData<
  ResponseData = DefaultResponse,
  RequestBody = DefaultPayload,
  QueryParams = DefaultParams,
  PathParams = DefaultUrlParams,
>(
  response: FetchResponse<ResponseData, RequestBody, QueryParams, PathParams>,
  responseType?: RequestConfig['responseType'],
): Promise<any> {
  // Bail early if response is null or undefined
  if (!response) {
    return null;
  }

  // Get the content-type header once
  const headers = (response as Response).headers;
  let contentType = headers && headers.get(CONTENT_TYPE);

  if (contentType) {
    // Lowercase and trim for consistent matching
    contentType = contentType.toLowerCase().trim();
  } else {
    contentType = '';
  }

  // Split for mime type without charset
  const mimeType = contentType.split(';', 1)[0];

  let data;

  try {
    if (responseType) {
      // The body is read as requested, or left unread as a stream to be read by the caller
      data =
        responseType === 'stream'
          ? response.body
          : await response[responseType]();
    } else if (
      mimeType.includes(APPLICATION_JSON) ||
      mimeType.includes('+json')
    ) {
      data = await response.json(); // Parse JSON response
    } else if (
      (mimeType.includes('multipart/form-data') || // Parse as FormData
        mimeType.includes(
          APPLICATION_CONTENT_TYPE + 'x-www-form-urlencoded', // Handle URL-encoded forms
        )) &&
      typeof response.formData === FUNCTION
    ) {
      data = await response.formData();
    } else if (/^(image|video|audio)\/|octet-stream|pdf|zip/.test(mimeType)) {
      data = await response.arrayBuffer(); // Parse as ArrayBuffer for binary types
    } else {
      data = await response.text();

      if (typeof data === STRING) {
        const trimmed = data.trim();
        if (
          (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
          (trimmed.startsWith('[') && trimmed.endsWith(']'))
        ) {
          try {
            data = JSON.parse(trimmed);
          } catch {
            // leave as text if parsing fails
          }
        }
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_error) {
    // Parsing failed, fallback to null
    data = null;
  }

  return data;
}

/**
 * Prepare response object with additional information.
 *
 * @param Response. It may be "null" in case of request being aborted.
 * @param {RequestConfig} config - Request config
 * @param error - whether the response is erroneous
 * @returns {FetchResponse<ResponseData, RequestBody, QueryParams, PathParams>} Response data
 */
export const prepareResponse = <
  ResponseData = DefaultResponse,
  RequestBody = DefaultPayload,
  QueryParams = DefaultParams,
  PathParams = DefaultUrlParams,
>(
  response: FetchResponse<
    ResponseData,
    RequestBody,
    QueryParams,
    PathParams
  > | null,
  config: RequestConfig<ResponseData, QueryParams, PathParams, RequestBody>,
  error: ResponseError<
    ResponseData,
    RequestBody,
    QueryParams,
    PathParams
  > | null = null,
): FetchResponse<ResponseData, RequestBody, QueryParams, PathParams> => {
  const defaultResponse = config.defaultResponse;
  const cacheKey = config.cacheKey;
  const mutatator = mutate.bind(null, cacheKey as string) as FetchResponse<
    ResponseData,
    RequestBody,
    QueryParams,
    PathParams
  >['mutate'];

  // This may happen when request is cancelled.
  if (!response) {
    return {
      ok: false,
      // Enhance the response with extra information
      error,
      data: defaultResponse ?? null,
      headers: null,
      config,
      mutate: mutatator,
      isFetching: false,
      isSuccess: false,
      isError: true,
    } as unknown as FetchResponse<
      ResponseData,
      RequestBody,
      QueryParams,
      PathParams
    >;
  }

  const isNativeResponse =
    typeof Response === FUNCTION && response instanceof Response;

  let data = response.data;

  // Set the default response if the provided data is an empty object or array
  // Other objects, e.g. Blobs, buffers and streams, have no keys either, but aren't empty
  if (
    defaultResponse !== undefined &&
    (data === undefined ||
      data === null ||
      (/^\[object (Object|Array)\]$/.test(
        Object.prototype.toString.call(data),
      ) &&
        Object.keys(data).length === 0))
  ) {
    response.data = data = defaultResponse;
  }

  if (config.flattenResponse) {
    response.data = data = flattenData(data);
  }

  if (config.select) {
    response.data = data = config.select(data);
  }

  const headers = processHeaders(response.headers);

  // Native fetch Response extended by extra information
  if (isNativeResponse) {
    const output: FetchResponse<
      ResponseData,
      RequestBody,
      QueryParams,
      PathParams
    > = {
      body: response.body,
      bodyUsed: response.bodyUsed,
      ok: response.ok,
      redirected: response.redirected,
      type: response.type,
      url: response.url,
      status: response.status,
      statusText: response.statusText,

      // Convert methods to use arrow functions to preserve correct return types
      // Lazily construct Blob from ArrayBuffer
      blob: async () =>
        data instanceof ArrayBuffer ? new Blob([data]) : new Blob(),
      json: async () => data as ResponseData, // Return the already parsed JSON data
      text: async () => data as string, // Return the already parsed text data
      // The body was already read, so a copy of this response is returned instead of Response.clone()
      clone: () => ({ ...output }),
      arrayBuffer: async () =>
        data instanceof ArrayBuffer ? data : new ArrayBuffer(0), // Return the ArrayBuffer directly
      formData: async () => (data instanceof FormData ? data : new FormData()), // Return the already parsed FormData
      bytes: async () =>
        new Uint8Array(data instanceof ArrayBuffer ? data : new ArrayBuffer(0)),
      // Enhance the response with extra information
      error,
      data,
      headers,
      config,
      mutate: mutatator,
      isFetching: false,
      isSuccess: response.ok && !error,
      isError: !!error,
    };

    return output;
  }

  // If it's a custom fetcher, and it does not return any Response instance, it may have its own internal handler
  if (isObject(response)) {
    Object.assign(response, {
      error,
      headers,
      isFetching: false,
      mutate: mutatator,
      isSuccess: response.ok && !error,
      isError: !!error,
    });
  }

  return response;
};

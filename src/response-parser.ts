/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  APPLICATION_CONTENT_TYPE,
  APPLICATION_JSON,
  CONTENT_TYPE,
  FUNCTION,
  OBJECT,
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
 * Parses the response data based on the Content-Type header.
 *
 * @param response - The Response object to parse.
 * @returns A Promise that resolves to the parsed data.
 */
export async function parseResponseData<ResponseData = DefaultResponse>(
  response: FetchResponse<ResponseData>,
): Promise<any> {
  // Bail early for HEAD requests or status codes, or any requests that never have a body
  if (!response || !response.body) {
    return null;
  }

  // Get the content-type header once
  let contentType = (response as Response).headers?.get(CONTENT_TYPE);

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
    if (mimeType.includes(APPLICATION_JSON) || mimeType.includes('+json')) {
      data = await response.json(); // Parse JSON response
    } else if (mimeType.includes('multipart/form-data')) {
      data = await response.formData(); // Parse as FormData
    } else if (mimeType.includes(APPLICATION_CONTENT_TYPE + 'octet-stream')) {
      data = await response.blob(); // Parse as blob
    } else if (
      mimeType.includes(APPLICATION_CONTENT_TYPE + 'x-www-form-urlencoded')
    ) {
      data = await response.formData(); // Handle URL-encoded forms
    } else if (mimeType.startsWith('text/')) {
      data = await response.text(); // Parse as text
    } else {
      try {
        const responseClone = response.clone();

        // Handle edge case of no content type being provided... We assume JSON here.
        data = await responseClone.json();
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_e) {
        // Handle streams
        data = await response.text();
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
 * @returns {FetchResponse<ResponseData>} Response data
 */
export const prepareResponse = <
  ResponseData = DefaultResponse,
  QueryParams = DefaultParams,
  PathParams = DefaultUrlParams,
  RequestBody = DefaultPayload,
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
    QueryParams,
    PathParams,
    RequestBody
  > | null = null,
): FetchResponse<ResponseData, RequestBody, QueryParams, PathParams> => {
  const defaultResponse = config.defaultResponse;

  // This may happen when request is cancelled.
  if (!response) {
    return {
      ok: false,
      isFetching: false,
      // Enhance the response with extra information
      error,
      data: defaultResponse ?? null,
      headers: null,
      config,
    } as unknown as FetchResponse<
      ResponseData,
      RequestBody,
      QueryParams,
      PathParams
    >;
  }

  let data = response.data;

  // Set the default response if the provided data is an empty object
  if (
    defaultResponse !== undefined &&
    (data === undefined ||
      data === null ||
      (typeof data === OBJECT && Object.keys(data).length === 0))
  ) {
    response.data = data = defaultResponse;
  }

  if (config.flattenResponse) {
    response.data = data = flattenData(data);
  }

  const headers = processHeaders(response.headers);

  // Native fetch Response extended by extra information
  if (typeof Response === FUNCTION && response instanceof Response) {
    return {
      body: response.body,
      bodyUsed: response.bodyUsed,
      ok: response.ok,
      redirected: response.redirected,
      type: response.type,
      url: response.url,
      status: response.status,
      statusText: response.statusText,

      // Convert methods to use arrow functions to preserve correct return types
      blob: () => response.blob(),
      json: () => response.json(),
      text: () => response.text(),
      clone: () => response.clone(),
      arrayBuffer: () => response.arrayBuffer(),
      formData: () => response.formData(),
      bytes: () => response.bytes(),

      // Enhance the response with extra information
      error,
      data,
      headers,
      config,
      isFetching: false,
    };
  }

  // If it's a custom fetcher, and it does not return any Response instance, it may have its own internal handler
  if (isObject(response)) {
    response.error = error;
    response.headers = headers;
    response.isFetching = false;
  }

  return response;
};

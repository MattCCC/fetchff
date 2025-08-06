import type {
  DefaultPayload,
  DefaultParams,
  DefaultUrlParams,
} from './api-handler';
import type {
  DefaultResponse,
  FetchResponse,
  MutationSettings,
  RequestConfig,
} from './request-handler';

export type RefetchFunction<
  ResponseData = DefaultResponse,
  RequestBody = DefaultPayload,
  QueryParams = DefaultParams,
  PathParams = DefaultUrlParams,
> = (
  // Whatever truthy value to force a refresh, or any other value.
  // It comes handy when passing the refetch directly to a click handler.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  forceRefresh?: boolean | any,
  requestConfig?: RequestConfig<
    ResponseData,
    QueryParams,
    PathParams,
    RequestBody
  >,
) => Promise<FetchResponse<
  ResponseData,
  RequestBody,
  QueryParams,
  PathParams
> | null>;

export interface UseFetcherResult<
  ResponseData = DefaultResponse,
  RequestBody = DefaultPayload,
  QueryParams = DefaultParams,
  PathParams = DefaultUrlParams,
> {
  /**
   * The fetched data, or null if not yet available.
   * This will be null if the request is in progress or if no data has been fetched yet.
   */
  data:
    | FetchResponse<ResponseData, RequestBody, QueryParams, PathParams>['data']
    | null;
  /**
   * The error encountered during the fetch operation, if any.
   * If the request was successful, this will be null.
   */
  error:
    | FetchResponse<ResponseData, RequestBody, QueryParams, PathParams>['error']
    | null;

  /**
   * Indicates if this is the first fetching attempt for the request since the hook was mounted.
   * Useful for showing loading indicators before any data is fetched.
   * @returns true when there is no data nor error yet and during any request in progress or is about to start.
   */
  isFirstFetch: boolean;

  /**
   * This is an alias for `isLoading`.
   * Indicates if the request is currently loading data.
   * @returns true during any request in progress excluding background revalidations.
   * @see isLoading
   */
  isFetching: boolean;

  /**
   * Indicates if the request is currently loading data.
   * @returns true during any request in progress excluding background revalidations.
   */
  isLoading: boolean;

  /**
   * Indicates if the request was successful (2xx status codes).
   * @returns true if the response is OK (2xx) and no error was thrown.
   */
  isSuccess: boolean;

  /**
   * Indicates if the request resulted in an error.
   * @returns true in cases of: non-2xx status code, network error, request failed, or response parsing error.
   */
  isError: boolean;

  /**
   * Indicates if the request is currently refetching data.
   * This is true when a fetch is in progress and there is already data displayed (i.e., not the initial load).
   * Useful for showing a subtle loading indicator when updating existing data.
   * @returns true when the request is refetching data.
   */
  isRefetching: boolean;

  /**
   * Function to mutate the cached data.
   * It updates the cache with new data and optionally triggers revalidation.
   *
   * @param {ResponseData} data - The new data to set in the cache.
   * @param {MutationSettings} [mutationSettings] - Optional settings for the mutation.
   *   - `revalidate`: If true, it will trigger a revalidation after mutating the cache.
   * @returns {Promise<FetchResponse<ResponseData, RequestBody, QueryParams, PathParams> | null>} The updated response or null if no cache key is set.
   */
  mutate: (
    data: FetchResponse<
      ResponseData,
      RequestBody,
      QueryParams,
      PathParams
    >['data'],
    mutationSettings?: MutationSettings,
  ) => Promise<FetchResponse<
    ResponseData,
    RequestBody,
    QueryParams,
    PathParams
  > | null>;
  /**
   * Function to refetch the data from the server.
   * This will trigger a new fetch operation and update the cache with the latest data.
   *
   * @returns {Promise<FetchResponse<ResponseData, RequestBody, QueryParams, PathParams> | null>} The new fetch response or null if no URL is set.
   */
  refetch: RefetchFunction<ResponseData, RequestBody, QueryParams, PathParams>;

  /**
   * The configuration object used for this fetcher instance.
   * This contains the settings and options passed to the hook.
   */
  config:
    | FetchResponse<
        ResponseData,
        RequestBody,
        QueryParams,
        PathParams
      >['config']
    | undefined;

  /**
   * The HTTP headers returned with the response, or undefined if not available.
   */
  headers:
    | FetchResponse<
        ResponseData,
        RequestBody,
        QueryParams,
        PathParams
      >['headers']
    | undefined;
}

import type {
  DefaultPayload,
  DefaultParams,
  DefaultUrlParams,
} from './api-handler';
import type { MutationSettings } from './cache-manager';
import type { DefaultResponse, FetchResponse } from './request-handler';

type RefetchFunction<
  ResponseData = DefaultResponse,
  RequestBody = DefaultPayload,
  QueryParams = DefaultParams,
  PathParams = DefaultUrlParams,
> = (
  // Whatever truthy value to force a refresh, or any other value.
  // It comes handy when passing the refetch directly to a click handler.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  forceRefresh?: boolean | any,
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
   * Indicates if the request is currently validating or fetching data.
   * This is true when the request is in progress, including revalidations.
   */
  isValidating: boolean;
  /**
   * Indicates if the request is currently loading data.
   * This is true when the request is in progress, including initial fetches.
   * It will be false if the data is already cached and no new fetch is in progress.
   */
  isLoading: boolean;
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
  ) => void;
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

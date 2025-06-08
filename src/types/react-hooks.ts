import { DefaultPayload, DefaultParams, DefaultUrlParams } from './api-handler';
import { MutationSettings } from './cache-manager';
import { DefaultResponse, FetchResponse } from './request-handler';

type RefetchFunction<
  ResponseData = DefaultResponse,
  RequestBody = DefaultPayload,
  QueryParams = DefaultParams,
  PathParams = DefaultUrlParams,
> = () => Promise<FetchResponse<
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
  error: FetchResponse<
    ResponseData,
    RequestBody,
    QueryParams,
    PathParams
  >['error'];
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
   * Alias for `refetch` function.
   * This is provided for compatibility with other libraries or patterns that expect a `trigger` function.
   */
  trigger: RefetchFunction<ResponseData, RequestBody, QueryParams, PathParams>;
}

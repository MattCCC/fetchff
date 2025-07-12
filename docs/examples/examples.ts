/**
 * This file contains various examples together with tests for typings declarations
 */
import { createApiFetcher, fetchf } from '../../src';
import type { Endpoint } from '../../src/types';

const endpoints = {
  ping: { url: 'ping' },
  fetchMovies: { url: 'movies' },
  fetchBooks: {
    url: 'books',
    unknownProperty: 'error',
  },
  fetchBook: {
    url: 'books/:bookId',
  },
};

// Example interfaces of responses, query params, and url path params
interface Book {
  id: number;
  title: string;
}

interface Books {
  books: Book[];
  totalResults: number;
}

interface Movie {
  id: number;
  title: string;
}

type Movies = Movie[];

interface BooksQueryParams {
  all: boolean;
}

interface BookQueryParams {
  newBook: boolean;
}

interface BookPathParams {
  bookId: number;
}

// Automatic type inference + how to obtain config and endpoints to modify
async function example1() {
  const api = createApiFetcher({
    apiUrl: '',
    endpoints,
  });

  const apiConfig = api.config;
  const endpointsList = api.endpoints;

  const { data } = await api.ping();

  // @ts-expect-error Endpoint ping2 does not exist
  await api.ping2();
  console.log('Example 1', data, apiConfig, endpointsList);
}

// With passed "typeof endpoints" to createApiFetcher()
async function example2() {
  const api = createApiFetcher({
    apiUrl: '',
    endpoints,
  });

  const apiConfig = api.config;
  const endpointsList = api.endpoints;

  api.ping();

  // @ts-expect-error Endpoint ping2 does not exist
  await api.ping2();

  const { data } = await api.ping<{ dd: string }>();

  console.log('Example 2', data, apiConfig, endpointsList);
}

// Explicit types passed to createApiFetcher()
async function example3() {
  // Note how you do not need to specify all endpoints for typings to work just fine.
  interface Endpoints {
    fetchBook: Endpoint<Book, BookQueryParams, BookPathParams>;
    fetchBooks: Endpoint<Books, BooksQueryParams>;
  }

  type EndpointsConfiguration = typeof endpoints;

  const api = createApiFetcher<Endpoints, EndpointsConfiguration>({
    apiUrl: '',
    endpoints,
  });

  const apiConfig = api.config;
  const endpointsList = api.endpoints;

  // Defined in EndpointsList
  const { data } = await api.ping();

  // Defined in EndpointsList with query param and url path param
  const { data: book } = await api.fetchBook({
    params: { newBook: true },
    urlPathParams: { bookId: 1 },
  });

  // Defined in "endpoints" but not in EndpointsList so there is no need to add "fetchMovies: Endpoint;" explicitly.
  const { data: movies1 } = await api.fetchMovies();

  // With dynamically inferred type
  const { data: movies } = await api.fetchMovies<Movies>();
  const { data: movies3 }: { data: Movies } = await api.fetchMovies<Movies>();

  // With custom params not defined in any interface
  const { data: movies4 } = await api.fetchMovies({
    params: {
      all: true,
    },
  });

  // @ts-expect-error This will result in an error as endpoint is not defined
  const { data: movies2 } = await api.nonExistentEndpoint();

  interface NewBook {
    alternativeInterface: string;
  }

  interface NewBookQueryParams {
    color: string;
  }

  // Overwrite response of existing endpoint
  const { data: book1 } = await api.fetchBook<NewBook, BookQueryParams>({
    params: { newBook: true },
    // @ts-expect-error should verify that bookId cannot be text
    urlPathParams: { bookId: 'text' },
  });

  // Overwrite response and query params of existing endpoint
  const { data: book11 } = await api.fetchBook<NewBook, NewBookQueryParams>({
    params: {
      // @ts-expect-error Should not allow old param
      newBook: true,
      color: 'green',
      // TODO: @ts-expect-error Should not allow non-existent param
      type: 'red',
    },
  });

  // Standard fetch with predefined response and query params
  const { data: books } = await api.fetchBooks({
    // TODO: @ts-expect-error Non-existent setting
    test: true,
    params: {
      // This param exists
      all: true,
      // @ts-expect-error Should not allow non-existent param
      randomParam: 1,
    },
  });

  const { data: book2 } = await api.fetchBook(
    { newBook: true },
    // @ts-expect-error Error as bookId is not a number
    { bookId: 'text' },
  );

  const { data: book3 } = await api.fetchBook({
    // @ts-expect-error Error as newBook is not a boolean
    params: { newBook: 'true' },
    urlPathParams: { bookId: 1 },
  });

  console.log('Example 3', data, apiConfig, endpointsList);
  console.log('Example 3', movies, movies1, movies2, movies3, movies4);
  console.log(
    'Example 3',
    books satisfies Books,
    book satisfies Book,
    book1 satisfies NewBook,
    book11 satisfies NewBook,
    book2 satisfies Book,
    book3 satisfies Book,
  );
}

// createApiFetcher() - direct API request() call to a custom endpoint with flattenResponse == true
async function example4() {
  interface Endpoints {
    fetchBooks: Endpoint<Books, BooksQueryParams>;
  }

  type EndpointsConfiguration = typeof endpoints;

  const api = createApiFetcher<Endpoints, EndpointsConfiguration>({
    apiUrl: '',
    endpoints,
    flattenResponse: true,
  });

  // Existing endpoint generic
  const { data: books } = await api.request<Books>('fetchBooks');

  // Custom URL
  const { data: data1 } = await api.request(
    'https://example.com/api/custom-endpoint',
  );

  interface OtherEndpointData {
    myData: true;
  }

  // Explicitly defined empty config
  const { data: data4 } = await api.request('fetchBooks', {
    params: {
      anyParam: true,
    },
  });

  // Dynamically added Response to a generic
  const { data: data2 } = await api.request<OtherEndpointData>(
    'https://example.com/api/custom-endpoint',
  );

  // Dynamically added Response to a generic using fetchf()
  const { data: data3 } = await fetchf<OtherEndpointData>(
    'https://example.com/api/custom-endpoint',
  );

  // Existing endpoint with custom params
  interface DynamicQueryParams {
    param1: string;
  }

  interface DynamicUrlParams {
    urlparam2: number;
  }

  const { data: books2 } = await api.request<
    Books,
    DynamicQueryParams,
    DynamicUrlParams
  >('fetchBooks', {
    // Native fetch() setting
    cache: 'no-store',
    // Extended fetch setting
    cacheTime: 86000,
    // TODO: @ts-expect-error Non-existent setting
    something: true,
    urlPathParams: {
      // @ts-expect-error Non-existent param
      urlparam1: '1',
      urlparam2: 1,
    },
    params: {
      param1: '1',
      // @ts-expect-error Non-existent param
      param2: 1,
    },
  });

  console.log('Example 4', books satisfies Books, books2 satisfies Books);
  console.log(
    'Example 4',
    data1,
    data2 satisfies OtherEndpointData,
    data3 satisfies OtherEndpointData,
    data4,
  );
}

// createApiFetcher() - direct API request() call to a custom endpoint with flattenResponse == false
async function example5() {
  interface MyEndpoints {
    fetchBooks: Endpoint<Books, BooksQueryParams>;
  }

  type EndpointsConfiguration = typeof endpoints;

  const api = createApiFetcher<MyEndpoints, EndpointsConfiguration>({
    apiUrl: '',
    endpoints,
  });

  const { data: books2 } = await api.fetchBooks();
  const { data: books } = await api.request<Books>('fetchBooks', {});
  const { data: data1 } = await api.request(
    'https://example.com/api/custom-endpoint',
  );

  // Specify generic
  const { data: data2 } = await api.request<{ myData: true }>(
    'https://example.com/api/custom-endpoint',
  );

  console.log('Example 5', books, books2);
  console.log('Example 5', data1, data2);
}

// fetchf() - direct fetchf() request
async function example6() {
  const { data: books } = await fetchf<Books>('fetchBooks');
  const { data: data1 } = await fetchf(
    'https://example.com/api/custom-endpoint',
  );

  // Specify generic
  const { data: data2 } = await fetchf<{ myData: true }>(
    'https://example.com/api/custom-endpoint',
  );

  // Fetch with custom settings
  const { data: books2 } = await fetchf<Books>('fetchBooks', {
    // Native fetch() setting
    cache: 'no-store',
    // Extended fetch setting
    cacheTime: 86000,
    // @ts-expect-error Non-existent setting
    something: true,
  });

  console.log('Example 6', books satisfies Books, books2 satisfies Books);
  console.log('Example 6', data1, data2);
}

// fetchf() - direct fetchf() request with interceptor
async function example7() {
  const response = await fetchf('https://example.com/api/custom-endpoint', {
    onResponse(response) {
      response.data = { username: 'modified response' };
    },
  });

  console.log('Example 7', response);
}

// fetchf() - different error payload
async function example8() {
  interface SuccessResponseData {
    bookId: string;
    bookText: string;
  }

  interface ErrorResponseData {
    errorCode: number;
    errorText: string;
  }

  const { data, error } = await fetchf<SuccessResponseData | ErrorResponseData>(
    'https://example.com/api/custom-endpoint',
  );

  if (error) {
    const errorData = data as ErrorResponseData;

    console.log('Example 8 Error', errorData.errorCode);
  } else {
    console.log('Example 8 Success', data);
  }
}

// fetchf() - polling example
async function example9() {
  interface SuccessResponseData {
    bookId: string;
    bookText: string;
  }

  interface ErrorResponseData {
    errorCode: number;
    errorText: string;
  }

  const { data, error } = await fetchf<SuccessResponseData | ErrorResponseData>(
    'https://example.com/api/custom-endpoint',
    {
      pollingInterval: 1000, // Poll every second
      shouldStopPolling(response, attempt) {
        // Stop polling after 5 attempts or if the response contains an error
        return attempt >= 5 || 'errorCode' in response.data;
      },
    },
  );

  if (error) {
    const errorData = data as ErrorResponseData;

    console.log('Example 9 Error', errorData.errorCode);
  } else {
    console.log('Example 9 Success', data);
  }
}

example1();
example2();
example3();
example4();
example5();
example6();
example7();
example8();
example9();

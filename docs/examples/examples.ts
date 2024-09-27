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
  const { data: book } = await api.fetchBook({ newBook: true }, { bookId: 1 });

  // Defined in "endpoints" but not in EndpointsList. You don't need to add "fetchMovies: Endpoint;" explicitly.
  const { data: movies1 } = await api.fetchMovies();
  const { data: movies } = await api.fetchMovies<Movies>();
  const { data: movies3 }: { data: Movies } = await api.fetchMovies<Movies>();

  // @ts-expect-error This will result in an error as endpoint is not defined
  const { data: movies2 } = await api.nonExistentEndpoint();

  interface NewBook {
    alternativeInterface: string;
  }

  interface NewBookQueryParams {
    color: string;
  }

  // Overwrite response of existing endpoint
  const { data: book1 } = await api.fetchBook<NewBook>(
    { newBook: true },
    // @ts-expect-error should verify that bookId cannot be text
    { bookId: 'text' },
  );

  // Overwrite response and query params of existing endpoint
  const { data: book11 } = await api.fetchBook<NewBook, NewBookQueryParams>({
    // @ts-expect-error Should not allow old param
    newBook: true,
    color: 'green',
  });

  // Standard fetch with predefined response and query params
  const { data: books } = await api.fetchBooks({
    // This param exists
    all: true,
    // @ts-expect-error should catch "randomParam" that is not defined
    randomParam: 1,
  });

  const { data: book2 } = await api.fetchBook(
    { newBook: true },
    // @ts-expect-error Error as bookId is not a number
    { bookId: 'text' },
  );

  const { data: book3 } = await api.fetchBook(
    // @ts-expect-error Error as newBook is not a boolean
    { newBook: 'true' },
    { bookId: 1 },
  );

  console.log('Example 3', data, apiConfig, endpointsList);
  console.log('Example 3', movies, movies1, movies2, movies3);
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

  const { data: books } = await api.request<Books>('fetchBooks');
  const { data: data1 } = await api.request(
    'https://example.com/api/custom-endpoint',
  );

  // Specify generic
  const { data: data2 } = await api.request<{ myData: true }>(
    'https://example.com/api/custom-endpoint',
  );

  const { data: data3 } = await fetchf<{ myData: true }>(
    'https://example.com/api/custom-endpoint',
  );

  console.log('Example 4', books);
  console.log('Example 4', data1, data2, data3);
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

// fetchf() - direct fetchf() request with flattenResponse == false
async function example6() {
  const { data: books } = await fetchf<Books>('fetchBooks');
  const { data: data1 } = await fetchf(
    'https://example.com/api/custom-endpoint',
  );

  // Specify generic
  const { data: data2 } = await fetchf<{ myData: true }>(
    'https://example.com/api/custom-endpoint',
  );

  console.log('Example 6', books);
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

example1();
example2();
example3();
example4();
example5();
example6();
example7();

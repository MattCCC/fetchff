import { createApiFetcher } from '../../src';
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

  const data = await api.ping();

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

  const data = await api.ping<{ dd: string }>();

  console.log('Example 2', data, apiConfig, endpointsList);
}

// Explicit types passed to createApiFetcher()
async function example3() {
  // Note how you do not need to specify all endpoints for typings to work just fine.
  interface Endpoints {
    fetchBook: Endpoint<Book, BookQueryParams, BookPathParams>;
    fetchBooks: Endpoint<Books, BooksQueryParams>;
  }

  const api = createApiFetcher<Endpoints, typeof endpoints>({
    apiUrl: '',
    endpoints,
  });

  const apiConfig = api.config;
  const endpointsList = api.endpoints;

  // Defined in EndpointsList
  const data = await api.ping();

  // Defined in EndpointsList with query param and url path param
  const book = (await api.fetchBook(
    { newBook: true },
    { bookId: 1 },
  )) satisfies Book;

  // Defined in "endpoints" but not in EndpointsList. You don't need to add "fetchMovies: Endpoint;" explicitly.
  const movies1 = await api.fetchMovies();
  const movies = await api.fetchMovies<Movies>();
  const movies3: Movies = await api.fetchMovies<Movies>();

  // @ts-expect-error This will result in an error as endpoint is not defined
  const movies2 = await api.nonExistentEndpoint();

  const book1 = (await api.fetchBook<Book>(
    { newBook: true },
    // @ts-expect-error should verify that bookId cannot be text
    { bookId: 'text' },
  )) satisfies Book;

  // @ts-expect-error will result in an error since "someParams" is not defined
  const books = (await api.fetchBooks({ someParams: 1 })) satisfies Books;

  // @ts-expect-error Error as bookId is not a number
  const book2 = await api.fetchBook({ newBook: true }, { bookId: 'text' });

  // @ts-expect-error Error as newBook is not a boolean
  const book3 = await api.fetchBook({ newBook: 'true' }, { bookId: 1 });

  console.log('Example 3', data, apiConfig, endpointsList);
  console.log('Example 3', movies, movies1, movies2, movies3);
  console.log('Example 3', books, book, book1, book2, book3);
}

example1();
example2();
example3();

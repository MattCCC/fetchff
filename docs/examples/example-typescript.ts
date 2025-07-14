import { createApiFetcher } from 'fetchff';
import type { Endpoint } from 'fetchff';

// Example endpoint interfaces
type Book = { id: number; title: string; rating: number };
type Books = { books: Book[]; totalResults: number };
type BookQueryParams = { newBook?: boolean; category?: string };
type BookPathParams = { bookId: number };

const endpoints = {
  fetchBooks: {
    url: '/books',
    method: 'GET' as const,
  },
  fetchBook: {
    url: '/books/:bookId',
    method: 'GET' as const,
  },
} as const;

interface EndpointsList {
  fetchBook: Endpoint<{
    response: Book;
    params: BookQueryParams;
    urlPathParams: BookPathParams;
  }>;
  fetchBooks: Endpoint<{ response: Books; params: BookQueryParams }>;
}

const api = createApiFetcher<EndpointsList>({
  baseURL: 'https://example.com/api',
  endpoints,
  strategy: 'softFail',
});

async function main() {
  // Properly typed request with URL params
  const { data: book } = await api.fetchBook({
    params: { newBook: true },
    urlPathParams: { bookId: 1 },
  });
  console.log('Book:', book);

  // Generic type can be passed directly for additional type safety
  const { data: books } = await api.fetchBooks<{ response: Books }>({
    params: { category: 'fiction' },
  });
  console.log('Books:', books);
}

main();

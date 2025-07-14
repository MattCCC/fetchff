import { createApiFetcher } from 'fetchff';

const api = createApiFetcher({
  apiUrl: 'https://example.com/api',
  endpoints: {
    getUser: {
      url: '/user-details/:id',
      method: 'GET',
    },
    getBooks: {
      url: '/books/all',
      method: 'GET',
    },
  },
});

async function main() {
  // Basic GET request with path param
  const { data: user } = await api.getUser({ urlPathParams: { id: 2 } });
  console.log('User:', user);

  // Basic GET request to fetch all books
  const { data: books } = await api.getBooks();
  console.log('Books:', books);
}

main();

import { createApiFetcher } from 'fetchff';

const api = createApiFetcher({
  apiUrl: 'https://api.example.com/',
  headers: {
    'Content-Type': 'application/json',
    Authorization: 'Bearer YOUR_TOKEN',
  },
  endpoints: {
    getProfile: {
      url: '/profile/:id',
    },
  },
});

async function main() {
  // GET request with custom headers and path param
  const { data: profile } = await api.getProfile({
    urlPathParams: { id: 123 },
  });
  console.log('Profile:', profile);
}

main();

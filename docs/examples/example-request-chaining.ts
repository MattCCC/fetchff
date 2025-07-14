import { createApiFetcher } from 'fetchff';

const api = createApiFetcher({
  baseURL: 'https://example.com/api',
  endpoints: {
    getUser: { url: '/user' },
    createPost: { url: '/post', method: 'POST' },
  },
});

interface PostData {
  title: string;
  content: string;
}

async function fetchUserAndCreatePost(userId: number, postData: PostData) {
  // Fetch user data
  const { data: userData } = await api.getUser({ params: { userId } });

  // Create a new post with the fetched user data
  return await api.createPost({
    body: {
      ...postData,
      userId: userData.id,
    },
  });
}

// Example usage
fetchUserAndCreatePost(1, { title: 'New Post', content: 'This is a new post.' })
  .then((response) => console.log('Post created:', response))
  .catch((error) => console.error('Error:', error));

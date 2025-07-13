import { createApiFetcher } from 'fetchff';

const api = createApiFetcher({
  apiUrl: 'https://example.com/api',
  // You can set default strategy for all endpoints
  strategy: 'softFail',
  endpoints: {
    sendMessage: {
      method: 'post',
      url: '/send-message/:postId',
      // You can override strategy for particular endpoint (we set the same here for demonstration)
      strategy: 'softFail',
    },
  },
});

async function sendMessage() {
  const { data, error } = await api.sendMessage({
    body: { message: 'Text' },
    urlPathParams: { postId: 1 },
  });

  if (error) {
    console.error('Request Error', error.message);
  } else {
    console.log('Message sent successfully:', data);
  }
}

sendMessage();

import { createApiFetcher } from 'fetchff';

const api = createApiFetcher({
  baseURL: 'https://example.com/api',
  endpoints: {
    sendMessage: {
      method: 'post',
      url: '/send-message/:postId',
      // strategy: 'silent',
    },
  },
});

async function sendMessage() {
  await api.sendMessage({
    body: { message: 'Text' },
    urlPathParams: { postId: 1 },
    strategy: 'silent',
    onError(error) {
      console.error('Silent error logged:', error.message);
    },
  });

  // Because of the strategy, if API call fails, it will never reach this point. Otherwise try/catch would need to be required.
  console.log('Message sent successfully');
}

sendMessage();

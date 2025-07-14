import { createApiFetcher } from 'fetchff';

const api = createApiFetcher({
  apiUrl: 'https://example.com/api',
  // strategy: 'defaultResponse',
  endpoints: {
    sendMessage: {
      method: 'post',
      url: '/send-message/:postId',
      // strategy: 'defaultResponse',
    },
  },
});

async function sendMessage() {
  const { data, error } = await api.sendMessage({
    body: { message: 'Text' },
    urlPathParams: { postId: 1 },
    strategy: 'defaultResponse',
    defaultResponse: { status: 'failed', message: 'Default response' },
    onError(error) {
      console.error('API error:', error.message);
    },
  });

  if (error) {
    console.warn('Message failed to send, using default response:', data);
    return;
  }

  console.log('Message sent successfully:', data);
}

sendMessage();

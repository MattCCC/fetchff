import { createApiFetcher } from 'fetchff';
import type { ResponseError } from 'fetchff';

const api = createApiFetcher({
  apiUrl: 'https://example.com/api',
  endpoints: {
    sendMessage: {
      method: 'post',
      url: '/send-message/:postId',
      strategy: 'reject',
    },
  },
});

async function sendMessage() {
  try {
    await api.sendMessage({
      body: { message: 'Text' },
      urlPathParams: { postId: 1 },
    });
    console.log('Message sent successfully');
  } catch (error) {
    console.error('Message failed to send:', (error as ResponseError).message);
  }
}

sendMessage();

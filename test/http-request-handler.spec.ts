import PromiseAny from 'promise-any';
import { HttpRequestHandler } from '../package/src/http-request-handler';

describe('API Handler', () => {
    const apiUrl = 'http://example.com/api/';

    console.warn = jest.fn();

    afterEach((done) => {
        done();
    });

    it('handleRequest() - should properly hang promise when using silent strategy', async() => {
        const httpRequestHandler = new HttpRequestHandler({
            strategy: 'silent',
        });

        httpRequestHandler.requestInstance.request = jest.fn().mockRejectedValue(new Error('Request Failed'));

        let response;
        const request = httpRequestHandler.get(apiUrl);

        let timeout = new Promise((resolve) => {
            let wait = setTimeout(() => {
                clearTimeout(wait);

                resolve('timeout');
            }, 2000)
        })

        response = await PromiseAny([
            request,
            timeout,
        ]);

        expect(response).toBe("timeout");
    });
});

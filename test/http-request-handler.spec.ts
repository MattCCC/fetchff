import PromiseAny from 'promise-any';
import { HttpRequestHandler } from '../src/http-request-handler';

describe('API Handler', () => {
    const apiUrl = 'http://example.com/api/';
    const axiosResponseMock = {
        data: {
            'test': 'data'
        }
    }

    console.warn = jest.fn();

    afterEach((done) => {
        done();
    });

    describe('handleRequest()', () => {
        it('should properly hang promise when using Silent strategy', async () => {
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

            expect(typeof request.then).toBe('function');

            response = await PromiseAny([
                request,
                timeout,
            ]);

            expect(response).toBe("timeout");
        });

        it('should reject promise when using rejection strategy', async () => {
            const httpRequestHandler = new HttpRequestHandler({
                strategy: 'reject',
            });

            httpRequestHandler.requestInstance.request = jest.fn().mockRejectedValue(new Error('Request Failed'));

            let response;

            try {
                response = await httpRequestHandler.delete(apiUrl);
            } catch (error) {
            }

            expect(response).toBe(undefined);
        });

        it('should reject promise when using Throw Error strategy', async () => {
            const httpRequestHandler = new HttpRequestHandler({
                strategy: 'throwError',
            });

            httpRequestHandler.requestInstance.request = jest.fn().mockRejectedValue(new Error('Request Failed'));

            try {
                await httpRequestHandler.delete(apiUrl);
            } catch (error) {
                expect(typeof error).toBe("object");
            }
        });
    });

    describe('processResponseData()', () => {
        it('should show nested data object if flattening is off', async () => {
            const httpRequestHandler = new HttpRequestHandler({
                flattenResponse: false,
            });

            httpRequestHandler.requestInstance.request = jest.fn().mockResolvedValue(axiosResponseMock);

            const response = await httpRequestHandler.put(apiUrl);

            expect(response).toMatchObject(axiosResponseMock);
        });

        it('should handle nested data if data flattening is on', async () => {
            const httpRequestHandler = new HttpRequestHandler({
                flattenResponse: true,
            });

            httpRequestHandler.requestInstance.request = jest.fn().mockResolvedValue(axiosResponseMock);

            const response = await httpRequestHandler.post(apiUrl);

            expect(response).toMatchObject(axiosResponseMock.data);
        });

        it('should handle deeply nested data if data flattening is on', async () => {
            const httpRequestHandler = new HttpRequestHandler({
                flattenResponse: true,
            });

            httpRequestHandler.requestInstance.request = jest.fn().mockResolvedValue({ data: axiosResponseMock });

            const response = await httpRequestHandler.patch(apiUrl);

            expect(response).toMatchObject(axiosResponseMock.data);
        });

        it('should return null if there is no data', async () => {
            const httpRequestHandler = new HttpRequestHandler({
                flattenResponse: true,
            });

            httpRequestHandler.requestInstance.request = jest.fn().mockResolvedValue({});

            expect(await httpRequestHandler.head(apiUrl)).toBe(null);
        });
    });
});

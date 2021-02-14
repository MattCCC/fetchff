import { ApiHandler } from '../src/api-handler';
import { apiEndpoints, IEndpoints } from "./mocks/endpoints";

describe('API Handler', () => {
    const apiUrl = 'http://example.com/api/';
    const config = {
        apiUrl,
        apiEndpoints,
    };
    const userDataMock = { "name": "Mark" };

    console.warn = jest.fn();

    afterEach((done) => {
        done();
    });

    it('getInstance() - should obtain method of the API request provider', () => {
        const api = new ApiHandler(config);

        expect(typeof api.getInstance().request).toBe("function");
    });

    it('__get() - should trigger request handler for an existent endpoint', async () => {
        const api = new ApiHandler(config);

        api.handleRequest = jest.fn().mockResolvedValueOnce(userDataMock);

        const endpoints = api as unknown as IEndpoints;
        const response = await endpoints.getUserDetails({ userId: 1 });

        expect(api.handleRequest).toHaveBeenCalledTimes(1);
        expect(api.handleRequest).toHaveBeenCalledWith("getUserDetails", { "userId": 1 });
        expect(response).toBe(userDataMock);
    });

    it('__get() - should not trigger request handler for non-existent endpoint', async () => {
        const api = new ApiHandler(config);

        api.handleRequest = jest.fn().mockResolvedValueOnce(userDataMock);

        const response = await api.getUserAddress({ userId: 1 });

        expect(api.handleRequest).not.toHaveBeenCalled();
        expect(response).toBeNull();
    });
});

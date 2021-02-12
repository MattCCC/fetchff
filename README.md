# Axios Multi API

[![NPM](https://nodei.co/npm/axios-multi-api.png)](https://npmjs.org/package/axios-multi-api
)

Often times projects require complex APIs setups, middlewares and another stuff just to handle lots of API requests. Axios API Handler simplifies API handling to the extent that developers can focus on operating on the fetched data from their APIs rather than on complex initial setups.

This package helps achieving that in a simplistic declarative fashion. It also aims to provide a possibility to use global error handling in an easy manner. It uses very simple magic methods and catch decorators in order to achieve that.

You can also set up multiple API handlers for different collection of APIs from different services.


> If you’re new to Axios, please checkout [this handy Axios readme](https://github.com/axios/axios)

> Package was originally written to accomodate many API requests in an orderly fashion.

## Installation

Install package:
```bash
npm i axios-multi-api
```

## Usage

```typescript
import { ApiHandler } from 'axios-multi-api';

const api = new ApiHandler({
    apiUrl: 'http://example.com/api/',
    apiEndpoints: {
      getUserDetails: {
        method: 'get',
        url: '/user-details/get',
      },
      updateUserDetails: {
        method: 'post',
        url: '/user-details/update/:userId',
      },
    },
});

const response = api.getUserDetails({
  userId: 1
});

api.updateUserDetails({ name: 'Mark' }, { userId: 1 });
```
In this basic demo we fetch data from an API for user with an ID of 1. We also update user's name to Mark.

First argument of APIs functions is an object with query params for `GET` requests, or with a payload for `POST` requests. Another request types are supported as well.

Second argument is optional, and gives possibility to modify urls structure in a declarative way. In our example `/user-details/update/:userId` will become `/user-details/update/1` when API request will be made.

## Accessing Axios instance

Under the hood, a new Axios instance is created when handler is initialized. You can call `api.getInstance()` if you want to operate on Axios instance directly, e.g. to add some interceptors.


## Full TypeScript support

For TypeScript support you could modify interface of `api` and use your own for the API Endpoints provided.

## Additional Configuration
`strategy`
Default: `silent`
Available: `silent` | `reject` | `throwError`

> `silent`
> Can be used for a requests that are dispatched within asynchronous wrapper functions
> Those functions should preferably never be awaited
> If a request fails, promise will silently hang and no action underneath will be performed
> Please remember that this is not what Promises were made for, however if used properly it saves developers from try/catch or additional response data checks everywhere

> `reject`
> Promise will be simply rejected and global error handling triggered right before the rejection

> `throwError`
> An exception with Error object will be triggered. Using this approach you need to remember to set try/catch per each request to catch exceptions properly.

`timeout`
Default `30000`

You can set a timeout in milliseconds.

`logger`
Default `console`

You can additionally specify logger property with your custom logger to automatically log the errors to the console.

`httpRequestErrorService`
Default `null`

You can specify either class or a function that will be triggered whenever an endpoint fails. If it's a class it should expose a `process` method Axios Error Object will be sent as a first argument of it.

## Advanced demo

You could for example create an API service class that extends the handler, inject an error service class to handle with a store that would collect the errors.

As you may notice there's also a `setupInterceptor` and `httpRequestHandler` exposed. You can operate on it instead of requesting an Axios instance prior the operation. In this way you can use all Axios configuration settings on a particular API handler.


```typescript
import { ApiHandler } from 'axios-multi-api';

export class ApiService extends ApiHandler {
    /**
     * Creates an instance of Api Service.
     * @param {object} payload                   Payload
     * @param {string} payload.apiUrl            Api url
     * @param {string} payload.apiEndpoints      Api endpoints
     * @param {*} payload.logger                 Logger instance
     * @param {*} payload.storeDispatcher        A dispatcher function to dispatch data to the store
     * @memberof ApiService
     */
    public constructor({
        apiUrl,
        apiEndpoints,
        logger,
        storeDispatcher,
    }) {
        super({
            apiUrl,
            apiEndpoints,
            logger,
            httpRequestErrorService: new HttpRequestErrorService(storeDispatcher),
        });

        this.setupInterceptor();
    }

    /**
     * Setup Request Interceptor
     * @returns {void}
     */
    protected setupInterceptor(): void {
        this.httpRequestHandler.interceptRequest(onRequest);
    }
}

const api = new ApiService({
  //...
});
```

## ToDo
1) Better Axios Instance exposure.
2) Improve Readme by adding more information.
3) Cancellation strategies support.
4) Better API exposure.

## Support & collaboration

If you have any idea for an improvement, please file an issue. Feel free to make a PR if you are willing to collaborate on the project. Thank you :)

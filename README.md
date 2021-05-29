# Axios Multi API

[npm-url]: https://npmjs.org/package/axios-multi-api
[npm-image]: http://img.shields.io/npm/v/axios-multi-api.svg

[![NPM version][npm-image]][npm-url]  [![Blazing Fast](https://badgen.now.sh/badge/speed/blazing%20%F0%9F%94%A5/green)](https://github.com/MattCCC/axios-multi-api)

Oftentimes projects require complex APIs setups, middlewares and another stuff to accomodate a lot of API requests. Axios API Handler simplifies API handling to the extent that developers can focus on operating on the fetched data from their APIs rather than on complex initial setups.

This package helps in handling of many API endpoints in a simple, declarative fashion. It also aims to provide a possibility to use a global error handling in an easy manner.

You can set up multiple API handlers for different sets of APIs from different services. This provides much better scalability for many projects.

> If you’re new to Axios, please checkout [this handy Axios readme](https://github.com/axios/axios)

Package was originally written to accomodate many API requests in an orderly fashion.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [API methods](#api-methods)
- [Accessing Axios instance](#accessing-axios-instance)
- [Global Settings](#global-settings)
- [Single Endpoint Settings](#single-endpoint-settings)
- [Full TypeScript support](#full-typescript-support)
- [Advanced example](#advanced-example)
- [ToDo](#todo)
- [Support & collaboration](#support-collaboration)


## Features
- Multi APIs support
- Support for multiple response resolving strategies
- Support for dynamic urls
- Multiple requests chaining (using promises)
- Browsers & Node 12+ compatible
- TypeScript compatible

## ToDo

- Cancellation strategies support
- Per request cache
- Better API exposure

## Installation
[![NPM](https://nodei.co/npm/axios-multi-api.png)](https://npmjs.org/package/axios-multi-api)

Run following command to install the package:
```bash
npm i axios-multi-api
```

## Usage

```typescript
import { createApiFetcher } from 'axios-multi-api';

const api = createApiFetcher({
    apiUrl: 'https://example.com/api/',
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
    // Optionally
    httpRequestErrorService: (error) => {
      console.log('Request failed', error);
    }
});

const data = api.getUserDetails({ userId: 1 });

api.updateUserDetails({ name: 'Mark' }, { userId: 1 });
```
In this basic example we fetch data from an API for user with an ID of 1. We also update user's name to Mark. If you prefer OOP you can import `ApiHandler` and initialize the handler using `new ApiHandler()` instead.

## API methods
##### api.yourEndpointName(queryParams, urlParams, requestConfig)

`queryParams` / `payload` (optional)

First argument of APIs functions is an object with query params for `GET` requests, or with a payload for `POST` requests. Another request types are supported as well.

Query params accept arrays. If you pass { foo: [1, 2] }, it will become: foo[]=1&foo[]=2 automatically.

`urlParams` (optional)

It gives possibility to modify urls structure in a declarative way. In our example `/user-details/update/:userId` will become `/user-details/update/1` when API request will be made.

`requestConfig` (optional)

Axios compatible [Request Config](https://github.com/axios/axios#request-config) for particular endpoint. It will overwrite the global settings.

##### api.getInstance()

When API handler is firstly initialized, a new Axios instance is created. You can call `api.getInstance()` if you want to get that instance directly, for example to add some interceptors.

## Global Settings

Global settings is passed to `createApiFetcher()` function. You can pass all [Axios Request Config](https://github.com/axios/axios#request-config). Additional options are listed below.

| Option        | Type    | Default | Description                                                                                                                                                                                                                                               |
| ------------- | ------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| apiUrl | string |     | Your API base url. |
| apiEndpoints | object |  | List of your endpoints. Check [Single Endpoint Settings](#single-endpoint-settings) for options. |
| strategy | string | `reject` | Available: `silent`, `reject`, `throwError`<br><br>`silent` can be used for a requests that are dispatched within asynchronous wrapper functions. If a request fails, promise will silently hang and no action underneath will be performed. Please remember that this is not what Promises were made for, however if used properly it saves developers from try/catch or additional response data checks everywhere<br><br>`reject` will simply reject the promise and global error handling will be triggered right before the rejection.<br><br>`throwError` will thrown an exception with Error object. Using this approach you need to remember to set try/catch per each request to catch exceptions properly. |
| flattenResponse | boolean | `true` | Flattens nested response.data so you can avoid writing `response.data.data` and obtain response directly. Response is flattened whenever there is a "data" within response "data", and no other object properties set. |
| timeout | int | `30000` | You can set a timeout in milliseconds. |
| logger | any | `console` | You can additionally specify logger property with your custom logger to automatically log the errors to the console. |
| httpRequestErrorService | any | | You can specify a function or class that will be triggered when an endpoint fails. If it's a class it should expose a `process` method. Axios Error Object will be sent as a first argument of it. |

## Single Endpoint Settings

Globally specified endpoints in `apiEndpoints` are objects that accept following properties:


| Option | Type   | Default | Description        |
| ------ | ------ | ------- | ------------------ |
| method | string |         | Default request method e.g. GET, POST etc. Must be lowercase. |
| url | string |         | Url path e.g. /user-details/get |

## Full TypeScript support

Axios-multi-api includes necessary [TypeScript](http://typescriptlang.org) definitions. For full TypeScript support for your endpoints, you could overwrite interface using Type Assertion of your `ApiHandler` and use your own for the API Endpoints provided.

### Example of interface

```typescript
import {
  Endpoints,
  Endpoint,
  APIQueryParams,
  APIUrlParams,
} from 'axios-multi-api/dist/types/api';

import { createApiFetcher } from 'axios-multi-api';

interface EndpointsList extends Endpoints {
  fetchMovies: Endpoint<myQueryParams, myURLParams, myResponse>;
  fetchTVSeries: Endpoint;
}

const api = (createApiFetcher({
  // Your config
}) as unknown) as EndpointsList;
```

Package ships interfaces with responsible defaults making it easier to add new endpoints. It exposes `Endpoints` and `Endpoint` types.

## Advanced example

You could for example create an API service class that extends the handler, inject an error service class to handle with a store that would collect the errors.

As you may notice there's also a `setupInterceptor` and `httpRequestHandler` exposed. You can operate on it instead of requesting an Axios instance prior the operation. This way you can use all Axios settings for a particular API handler.


```typescript
import { ApiHandler } from 'axios-multi-api';

export class ApiService extends ApiHandler {
    /**
     * Creates an instance of Api Service.
     * @param {object} payload                   Payload
     * @param {string} payload.apiUrl            Api url
     * @param {string} payload.apiEndpoints      Api endpoints
     * @param {*} payload.logger                 Logger instance
     * @param {*} payload.storeDispatcher        A dispatcher function to dispatch data to a store
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
  // Your config
});
```

## Support & collaboration

If you have any idea for an improvement, please file an issue. Feel free to make a PR if you are willing to collaborate on the project. Thank you :)

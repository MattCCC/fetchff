# Axios Multi API

[npm-url]: https://npmjs.org/package/axios-multi-api
[npm-image]: http://img.shields.io/npm/v/axios-multi-api.svg

[![NPM version][npm-image]][npm-url] [![Blazing Fast](https://badgen.now.sh/badge/speed/blazing%20%F0%9F%94%A5/green)](https://github.com/MattCCC/axios-multi-api) [![Code Coverage](https://badgen.now.sh/badge/coverage/94.53/blue)](https://github.com/MattCCC/axios-multi-api) [![npm downloads](https://img.shields.io/npm/dm/axios-multi-api.svg?style=flat-square)](http://npm-stat.com/charts.html?package=axios-multi-api) [![install size](https://packagephobia.now.sh/badge?p=axios-multi-api)](https://packagephobia.now.sh/result?p=axios-multi-api)

## Why?

To handle many API endpoints and calls in a simple, declarative fashion. It aims to provide a possibility to additional fetching features with absolutely minimal code footprint.

Oftentimes projects require complex APIs setups, middlewares and another stuff to accommodate a lot of API requests. This package simplifies API handling to the extent that developers can focus on operating on the fetched data from their APIs rather than on complex setups. You can set up multiple API fetchers for different sets of APIs from different services. It provides much better scalability for many projects.

> If you’re new to Axios, please check out [this handy Axios readme](https://github.com/axios/axios)

Package was originally written to accommodate many API requests in an orderly fashion.

## Features

- **Pure JavaScript, framework independent**
- **Easily manage large applications with many API endpoints**
- **Native fetch() support by default, so Axios can be skipped**
- Error handling - global and per request
- Automatic cancellation of previous requests using `AbortController`
- Global and per request timeouts
- Multiple fetching strategies when requests fail - promise rejection, silently hang promise, provide default response,
- Dynamic URLs support e.g. `/user/:userId`
- Multiple requests chaining (using promises)
- All Axios options are supported
- 100% performance oriented solution
- **Browsers and Node 18+ compatible**
- **Fully TypeScript compatible**
- **Very lightweight, only a few KBs, gziped**

Please open an issue for future requests.

## ✔️ Quick Start

[![NPM](https://nodei.co/npm/axios-multi-api.png)](https://npmjs.org/package/axios-multi-api)

Using NPM:

```bash
npm install axios-multi-api
```

Using yarn:

```bash
yarn add axios-multi-api
```

The native `fetch()` is used by default. If you want to use Axios, install it separately e.g. by running `npm install axios`, and then pass the import to the `createApiFetcher()` function. Check advanced example for more details.

```typescript
import { createApiFetcher } from 'axios-multi-api';

const api = createApiFetcher({
  apiUrl: 'https://example.com/api',
  endpoints: {
    getUser: {
      url: '/user-details',
    },
  },
});

// Make API GET request to: http://example.com/api/user-details?userId=1&ratings[]=1&ratings[]=2
const response = await api.getUser({ userId: 1, ratings: [1, 2] });
```

## ✔️ Advanced Usage

```typescript
import axios from 'axios';
import { createApiFetcher } from 'axios-multi-api';

const endpoints = {
  getUser: {
    method: 'get',
    url: '/user-details',
  },

  // No need to specify method: 'get' for GET requests
  getPosts: {
    url: '/posts/:subject',
  },

  updateUserDetails: {
    method: 'post',
    url: '/user-details/update/:userId',
  },
};

const api = createApiFetcher({
  endpoints,
  fetcher: axios,
  apiUrl: 'https://example.com/api',
  onError(error) {
    console.log('Request failed', error);
  },
  // Optional: default headers (axios config is supported)
  headers: {
    'my-auth-key': 'example-auth-key-32rjjfa',
  },
});

// Fetch user data - "response" will return data directly
// GET to: http://example.com/api/user-details?userId=1&ratings[]=1&ratings[]=2
const response = await api.getUser({ userId: 1, ratings: [1, 2] });

// Fetch posts - "response" will return data directly
// GET to: http://example.com/api/posts/myTestSubject?additionalInfo=something
const response = await api.getPosts(
  { additionalInfo: 'something' },
  { subject: 'myTestSubject' },
);

// Send POST request to update userId "1"
await api.updateUserDetails({ name: 'Mark' }, { userId: 1 });

// Send POST request to update array of user ratings for userId "1"
await api.updateUserDetails({ name: 'Mark', ratings: [1, 2] }, { userId: 1 });
```

In the example above we fetch data from an API for user with an ID of 1. We also update user's name to Mark. If you prefer OOP you can import `ApiHandler` and initialize the handler using `new ApiHandler()` instead. In case of using typings, due to magic methods being utilized, you may need to overwrite the type: `const api = new ApiHandler(config) as ApiHandler & EndpointsList` where `EndpointsList` is the list of your endpoints.

## ✔️ Easy to use with React and other libraries

You could use [React Query](https://react-query-v3.tanstack.com/guides/queries) hooks with API handler:

```typescript
import axios from 'axios';
import { createApiFetcher } from 'axios-multi-api';

const api = createApiFetcher({
  fetcher: axios, // Optional, native fetch() will be used otherwise
  apiUrl: 'https://example.com/api',
  strategy: 'reject',
  endpoints: {
    getProfile: {
      url: '/profile/:id',
    },
  },
  onError(error) {
    console.log('Request failed', error);
  },
});

export const useProfile = ({ id }) => {
  return useQuery(['profile', id], () => api.getProfile({ id }), {
    initialData: [],
    initialDataUpdatedAt: Date.now(),
    enabled: id > 0,
    refetchOnReconnect: true,
  });
};
```

## ✔️ API

##### api.endpointName(queryParams, urlParams, requestConfig)

`queryParams` / `payload` (optional)

First argument of API functions is an object with query params for `GET` requests, or with a data payload for `POST` alike requests. Other request types are supported as well. For `POST` alike requests you may occasionally want to use both query params and payload. In such case, use this argument as query params and pass the payload as 3rd argument `requestConfig.body` or `requestConfig.data` (for Axios)

Query params accepts strings, numbers, and even arrays, so you pass { foo: [1, 2] } and it will become: foo[]=1&foo[]=2 automatically.

`urlParams` (optional)

It gives possibility to modify urls structure in a declarative way. In our example `/user-details/update/:userId` will become `/user-details/update/1` when API request will be made.

`requestConfig` (optional)

To have more granular control over specific endpoints you can pass Axios compatible [Request Config](https://github.com/axios/axios#request-config) for particular endpoint. You can also use Global Settings like `cancellable` or `strategy` mentioned below.

##### api.getInstance()

When API handler is firstly initialized, a new Axios instance is created. You can call `api.getInstance()` if you want to get that instance directly, for example to add some interceptors.

##### api.config

You can access `api.config` directly, so to modify global headers, and other settings on fly. Please mind it is a property, not a function.

##### api.endpoints

You can access `api.endpoints` directly, so to modify endpoints list. It can be useful if you want to append or remove global endpoints. Please mind it is a property, not a function.

## ✔️ Improved native fetch() error handling

Usually, when the fetch() function call fails in JavaScript, it does not throw an error for HTTP error statuses (like 404 or 500). Instead, it returns a resolved Promise with an `ok` property set to `false` on the Response object. Only if there is a network error or some other failure in making the request (like the server is down), `fetch()` will reject the Promise.

The issue with this approach is that it introduces inconsistency that is oftentimes skipped by developers. This package "fixes" the issue by triggering errors regardless of whether they come from API status out of 200-299 range or it is network error. The full `fetch()` Response is then passed to the `error`.

## ✔️ Settings

Global settings are passed to `createApiFetcher()` function. Settings that are global only are market with star `*` next to setting name.

You can pass settings on per-request basis in the 3rd argument of endpoint function, for example `api.getUser({}, {}, { /* settings */ })`.

You can also pass all `fetch()` settings, or if you use Axios, you can pass all [Axios Request Config](https://github.com/axios/axios#request-config).

| Setting         | Type        | Default   | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --------------- | ----------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| apiUrl \*       | string      |           | Your API base url.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| endpoints \*    | object      |           | List of your endpoints. Check [Per Endpoint Settings](#per-endpoint-settings) for options.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| fetcher \*      | AxiosStatic | `fetch`   | The native `fetch()` is used by default. Axios instance imported from axios package can be used otherwise. Leave as is, if you do not intend to use Axios.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| strategy        | string      | `reject`  | Error handling strategies - basically what to return when an error occurs. It can be a default data, promise can be hanged (nothing would be returned) or rejected so to use try/catch.<br><br>Available: `silent`, `reject`, `defaultResponse`.<br><br>`reject` - standard way - simply rejects the promise. Global error handling is triggered right before the rejection. You need to set try/catch to catch errors.<br><br>`defaultResponse` in case of an error, it returns default response specified in global `defaultResponse` or per endpoint `defaultResponse` setting. Promise will not be rejected! Data from default response will be returned instead. It could be used together with object destructuring by setting `defaultResponse: {}` so to provide a responsible defaults.<br><br>`silent` can be used for requests that are dispatched within asynchronous wrapper functions that are not awaited. If a request fails, promise will silently hang and no action will be performed. In case of an error, the promise will never be resolved or rejected, and any code after will never be executed. If used properly it saves developers from try/catch or additional response data checks everywhere. You can use is in combination with `onError` so to handle errors globally. |
| cancellable     | boolean     | `false`   | If `true`, any previous requests to same API endpoint will be cancelled, if a subsequent request is made meanwhile. This helps you avoid unnecessary requests to the backend.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| rejectCancelled | boolean     | `false`   | If `true` and request is set to `cancellable`, a cancelled requests' promise will be rejected. By default, instead of rejecting the promise, `defaultResponse` is returned.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| flattenResponse | boolean     | `true`    | Flatten nested response data, so you can avoid writing `response.data.data` and obtain response directly. Response is flattened when there is a "data" within response "data", and no other object properties set.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| defaultResponse | any         | `null`    | Default response when there is no data or when endpoint fails depending on the chosen `strategy`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| timeout         | int         | `30000`   | You can set a request timeout for all requests or particular in milliseconds.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| onError         | function    |           | You can specify a function or class that will be triggered when endpoint fails. If it's a class it should expose a `process` method. When using native fetch(), the full Response Object is sent as a first argument of the function. In case of Axios, AxiosError object is sent.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| logger          | object      | `console` | You can additionally specify logger object with your custom logger to automatically log the errors to the console. It should contain at least `error` and `warn` functions. `console.log` is used by default.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| method          | string      |           | Default request method e.g. GET, POST, DELETE, PUT etc.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| url             | string      |           | URL path e.g. /user-details/get                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

## ✔️ Full TypeScript support

Axios-multi-api includes necessary [TypeScript](http://typescriptlang.org) definitions. For full TypeScript support for your endpoints, you could overwrite interface using Type Assertion of your `ApiHandler` and use your own for the API Endpoints provided.

### Example of interfaces

```typescript
import type { Endpoints, Endpoint } from 'axios-multi-api';
import { createApiFetcher } from 'axios-multi-api';

interface Book {
  id: number;
  title: string;
  genre: string;
  releaseDate: string;
  rating: number;
}

interface BooksResponseData {
  books: Book[];
  totalResults: number;
  totalPages: number;
}

interface BooksQueryParams {
  newBooks: boolean;
}

interface BooksDynamicURLParams {
  bookId?: number;
}

// You can either extend the Endpoints to skip defining every endpoint
// Or you can just define the EndpointsList and enjoy more strict typings
interface EndpointsList extends Endpoints {
  fetchBooks: Endpoint<
    BooksResponseData,
    BooksQueryParams,
    BooksDynamicURLParams
  >;

  // Or you can use just Endpoint. It is used by default for all endpoints
  fetchTVSeries: Endpoint;
}

const api = createApiFetcher<EndpointsList>({
  apiUrl: 'https://example.com/api/',
  endpoints: {
    fetchBooks: {
      url: 'books',
    },
    fetchBook: {
      url: 'books/:id',
    },
  },
});

// Will return an error since "newBooks" should be a boolean
const books = await api.fetchBooks({ newBooks: 1 });

// You can also pass generic type to the request directly
const book = await api.fetchBook<Book>({ newBooks: 1 }, { id: 1 });
```

Package ships interfaces with responsible defaults making it easier to add new endpoints. It exposes `Endpoints` and `Endpoint` types.

## ✔️ More examples

### Per-request Error handling - reject strategy (default)

```typescript
import { createApiFetcher } from 'axios-multi-api';

const api = createApiFetcher({
  apiUrl: 'https://example.com/api',
  endpoints: {
    sendMessage: {
      method: 'post',
      url: '/send-message/:postId',
    },
  },
});

async function sendMessage() {
  try {
    await api.sendMessage({ message: 'Text' }, { postId: 1 });

    console.log('Message sent successfully');
  } catch (error) {
    console.log(error);
  }
}

sendMessage();
```

### Per-request Error handling - defaultResponse strategy

```typescript
import { createApiFetcher } from 'axios-multi-api';

const api = createApiFetcher({
  apiUrl: 'https://example.com/api',
  endpoints: {
    sendMessage: {
      method: 'post',
      url: '/send-message/:postId',
    },
  },
});

async function sendMessage() {
  const response = await api.sendMessage(
    { message: 'Text' },
    { postId: 1 },
    {
      strategy: 'defaultResponse',
      // null is a default setting, you can change it to empty {} or anything
      // defaultResponse: null,
      onError(error) {
        // Callback is still triggered here
        console.log(error);
      },
    },
  );

  if (response === null) {
    // Because of the strategy, if API call fails, it will just return null
    return;
  }

  // You can do something with the response here
  console.log('Message sent successfully');
}

sendMessage();
```

### Per-request Error handling - silent strategy

```typescript
import { createApiFetcher } from 'axios-multi-api';

const api = createApiFetcher({
  apiUrl: 'https://example.com/api',
  endpoints: {
    sendMessage: {
      method: 'post',
      url: '/send-message/:postId',
    },
  },
});

async function sendMessage() {
  await api.sendMessage(
    { message: 'Text' },
    { postId: 1 },
    {
      strategy: 'silent',
      onError(error) {
        console.log(error);
      },
    },
  );

  // Because of the strategy, if API call fails, it will never reach this point. Otherwise try/catch would need to be required.
  console.log('Message sent successfully');
}

// Note that since strategy is "silent" and sendMessage should not be awaited anywhere
sendMessage();
```

### Per-request Error handling with Axios

```typescript
import axios from 'axios';
import { createApiFetcher } from 'axios-multi-api';

const api = createApiFetcher({
  fetcher: axios,
  apiUrl: 'https://example.com/api',
  endpoints: {
    sendMessage: {
      method: 'post',
      url: '/send-message/:postId',
    },
  },
});

async function sendMessage() {
  await api.sendMessage(
    { message: 'Text' },
    { postId: 1 },
    {
      onError(error) {
        if (error.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          console.log(error.response.data);
          console.log(error.response.status);
          console.log(error.response.headers);
        } else if (error.request) {
          // The request was made but no response was received
          // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
          // http.ClientRequest in node.js
          console.log(error.request);
        } else {
          // Something happened in setting up the request that triggered an Error
          console.log('Error', error.message);
        }
        console.log(error.config);
      },
    },
  );

  console.log('Message sent successfully');
}

sendMessage();
```

### OOP style with custom Error Handler (advanced)

You could for example create an API service class that extends the handler, inject an error service class to handle with a store that would collect the errors.

As you may notice there's also a `setupInterceptor` and `httpRequestHandler` exposed. You can operate on it instead of requesting an Axios instance prior the operation. This way you can use all Axios settings for a particular API handler.

```typescript
import axios from 'axios';
import { ApiHandler } from 'axios-multi-api';

class MyRequestError {
  public constructor(myCallback) {
    this.myCallback = myCallback;
  }

  public process(error) {
    this.myCallback('Request error', error);
  }
}

class ApiService extends ApiHandler {
  /**
   * Creates an instance of Api Service.
   * @param {object}  payload                   Payload
   * @param {string}  payload.apiUrl            Api url
   * @param {string}  payload.endpoints      Api endpoints
   * @param {*}       payload.logger                 Logger instance
   * @param {*}       payload.myCallback             Callback function, could be a dispatcher that e.g. forwards error data to a store
   */
  public constructor({ apiUrl, endpoints, logger, myCallback }) {
    // Pass settings to API Handler
    super({
      fetcher: axios,
      apiUrl,
      endpoints,
      logger,
      onError: new MyRequestError(myCallback),
    });

    this.setupInterceptor();
  }

  /**
   * Setup Request Interceptor
   * @returns {void}
   */
  protected setupInterceptor(): void {
    this.getInstance().interceptors.request.use(onRequest);
  }
}

const api = new ApiService({
  // Your global settings and endpoints
});
```

## ✔️ Support and collaboration

If you have any idea for an improvement, please file an issue. Feel free to make a PR if you are willing to collaborate on the project. Thank you :)

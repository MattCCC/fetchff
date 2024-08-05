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

- Fast, lightweight and reusable data fetching
- **Pure JavaScript, framework independent**
- **Easily manage large applications with many API endpoints**
- **Native fetch() support by default, so Axios can be skipped**
- Smart error retry with exponential backoff
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
const { data } = await api.getUser({ userId: 1, ratings: [1, 2] });
```

Standalone usage: (without endpoints):

```typescript
import { fetchf } from 'axios-multi-api';

const { data } = await fetchf('/api/user-details');
```

## ✔️ Easy to use with React and other libraries

You could use [React Query](https://react-query-v3.tanstack.com/guides/queries) hooks with API handler:

```typescript
import { createApiFetcher } from 'axios-multi-api';

const api = createApiFetcher({
  apiUrl: 'https://example.com/api',
  endpoints: {
    getProfile: {
      url: '/profile/:id',
    },
  },
});

export const useProfile = ({ id }) => {
  return useQuery(['profile', id], () => api.getProfile({ id }));
};
```

## ✔️ API

### api.myEndpoint(queryParams, urlPathParams, requestConfig)

Where "myEndpoint" is the name of your endpoint from `endpoints` object passed to the `createApiFetcher()`.

`queryParams` / `payload` (optional) - Query Parameters or Body Payload for POST requests.

First argument of API functions is an object with query params for `GET` requests, or with a data payload for `POST` alike requests. Other request types are supported as well. For `POST` alike requests you may occasionally want to use both query params and payload. In such case, use this argument as query params and pass the payload as 3rd argument `requestConfig.body` or `requestConfig.data` (for Axios)

Query params accepts strings, numbers, and even arrays, so you pass { foo: [1, 2] } and it will become: foo[]=1&foo[]=2 automatically.

`urlPathParams` (optional) - Dynamic URL Path Parameters

It gives possibility to modify URLs structure in a declarative way. In our example `/user-details/update/:userId` will become `/user-details/update/1` when API request will be made.

`requestConfig` (optional) - Request Configuration to overwrite global config in case

To have more granular control over specific endpoints you can pass Axios compatible [Request Config](https://github.com/axios/axios#request-config) for particular endpoint. You can also use Global Settings like `cancellable` or `strategy` mentioned below.

### api.getInstance()

When API handler is firstly initialized, a new Axios instance is created. You can call `api.getInstance()` if you want to get that instance directly, for example to add some interceptors.

### api.config

You can access `api.config` directly, so to modify global headers, and other settings on fly. Please mind it is a property, not a function.

### api.endpoints

You can access `api.endpoints` directly, so to modify endpoints list. It can be useful if you want to append or remove global endpoints. Please mind it is a property, not a function.

## ✔️ fetchf() - improved native fetch() wrapper

The `axios-multi-api` wraps the endpoints around and automatically uses `fetchf()` under the hood. However, you can use `fetchf()` directly just like you use `fetch()`.

### Improvements to native fetch

To address these challenges, the `fetchf()` provides several enhancements:

1. **Consistent Error Handling:**

   - The `createApiFetcher()` and `fetchf()` both ensure that HTTP error statuses (e.g., 404, 500) are treated as errors. This is achieved by wrapping `fetch()` in a way that checks the response status and throws an exception if the `ok` property is `false`.
   - This approach aligns error handling with common practices and makes it easier to manage errors consistently.

2. **Enhanced Retry Mechanism:**

   - **Retry Configuration:** You can configure the number of retries, delay between retries, and exponential backoff for failed requests. This helps to handle transient errors effectively.
   - **Custom Retry Logic:** The `shouldRetry` asynchronous function allows for custom retry logic based on the error and attempt count, providing flexibility to handle different types of failures.

3. **Improved Error Visibility:**

   - **Error Wrapping:** The `createApiFetcher()` and `fetchf()` wrap errors in a custom `RequestError` class, which provides detailed information about the request and response, similarly to what Axios does. This makes debugging easier and improves visibility into what went wrong.
   - **Retry Conditions:** Errors are only retried based on configurable retry conditions, such as specific HTTP status codes or error types.

4. **Functional `fetchf()` Wrapper:**
   - **Wrapper Function:** `fetchf()` is a functional wrapper for `fetch()`. It integrates seamlessly with the retry mechanism and error handling improvements.
   - **No Class Dependency:** Unlike the traditional class-based approach, `fetchf()` can be used directly as a function, simplifying the usage and making it easier to integrate with functional programming styles.

### Improved Fetch Error Handling

In JavaScript, the native `fetch()` function does not reject the Promise for HTTP error statuses such as 404 (Not Found) or 500 (Internal Server Error). Instead, `fetch()` resolves the Promise with a `Response` object, where the `ok` property indicates the success of the request. If the request encounters a network error or fails due to other issues (e.g., server downtime), `fetch()` will reject the Promise.

**Challenges with Native Fetch:**

- **Error Status Handling:** Fetch does not throw errors for HTTP error statuses, making it difficult to distinguish between successful and failed requests based on status codes alone.
- **Error Visibility:** Error responses with status codes like 404 or 500 are not automatically propagated as exceptions, which can lead to inconsistent error handling.

## ✔️ Retry Mechanism

The exposed `fetchf()` and `createApiFetcher()` function include a built-in retry mechanism to handle transient errors and improve the reliability of network requests. This mechanism automatically retries requests when certain conditions are met, providing robustness in the face of temporary failures. Below is an overview of how the retry mechanism works and how it can be configured.

### Configuration

The retry mechanism is configured via the `retry` option when instantiating the `RequestHandler`. You can customize the following parameters:

- **`retries`**: Number of retry attempts to make after an initial failure. Default is `0` which means not to retry any requests.

- **`delay`**: Initial delay (in milliseconds) before the first retry attempt. Subsequent retries use an exponentially increasing delay based on the `backoff` parameter. Default is `1000`.

- **`maxDelay`**: Maximum delay (in milliseconds) between retry attempts. The delay will not exceed this value, even if the exponential backoff would suggest a longer delay. Default is `30000`.

- **`backoff`**: Factor by which the delay is multiplied after each retry. For example, a `backoff` factor of `1.5` means each retry delay is 1.5 times the previous delay. Default is `1.5`.

- **`retryOn`**: Array of HTTP status codes that should trigger a retry. By default, retries are triggered for the following status codes:

  - `408` - Request Timeout
  - `409` - Conflict
  - `425` - Too Early
  - `429` - Too Many Requests
  - `500` - Internal Server Error
  - `502` - Bad Gateway
  - `503` - Service Unavailable
  - `504` - Gateway Timeout

- **`shouldRetry(error, attempts)`**: Function that determines whether a retry should be attempted based on the error and the current attempt number. This function receives the error object and the attempt number as arguments.

### How It Works

1. **Initial Request**: When a request fails, the retry mechanism captures the failure and checks if it should retry based on the `retryOn` configuration and the result of the `shouldRetry` function.

2. **Retry Attempts**: If a retry is warranted:

   - The request is retried up to the specified number of attempts (`retries`).
   - Each retry waits for a delay before making the next attempt. The delay starts at the initial `delay` value and increases exponentially based on the `backoff` factor, but will not exceed the `maxDelay`.

3. **Logging**: During retries, the mechanism logs warnings indicating the retry attempts and the delay before the next attempt, which helps in debugging and understanding the retry behavior.

4. **Final Outcome**: If all retry attempts fail, the request will throw an error, and the final failure is processed according to the configured error handling logic.

Check Examples section below for more information.

## ✔️ Settings (Request Config)

Global settings are passed to `createApiFetcher()` function. Settings that are global only are market with star `*` next to setting name.

Almost all settings can be passed on per-request basis in the third argument of endpoint function, for example `api.getUser({}, {}, { /* Request Config */ })`.

You can also pass all `fetch()` settings, or if you use Axios, you can pass all [Axios Request Config](https://github.com/axios/axios#request-config) settings.

| Setting           | Type               | Default                                  | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------- | ------------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| apiUrl \*         | string             |                                          | Your API base url.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| endpoints \*      | object             |                                          | List of your endpoints. Each endpoint accepts all these settings. They can be set globally or per-endpoint when they are called.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| fetcher \*        | AxiosStatic        | fetch                                    | The native `fetch()` is used by default. Axios instance imported from axios package can be used otherwise. Leave as is, if you do not intend to use Axios.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| strategy          | string             | reject                                   | Error handling strategies - basically what to return when an error occurs. It can be a default data, promise can be hanged (nothing would be returned) or rejected so to use try/catch.<br><br>Available: `silent`, `reject`, `defaultResponse`.<br><br>`reject` - standard way - simply rejects the promise. Global error handling is triggered right before the rejection. You need to set try/catch to catch errors.<br><br>`defaultResponse` in case of an error, it returns default response specified in global `defaultResponse` or per endpoint `defaultResponse` setting. Promise will not be rejected! Data from default response will be returned instead. It could be used together with object destructuring by setting `defaultResponse: {}` so to provide a responsible defaults.<br><br>`silent` can be used for requests that are dispatched within asynchronous wrapper functions that are not awaited. If a request fails, promise will silently hang and no action will be performed. In case of an error, the promise will never be resolved or rejected, and any code after will never be executed. If used properly it saves developers from try/catch or additional response data checks everywhere. You can use is in combination with `onError` so to handle errors globally. |
| cancellable       | boolean            | false                                    | If `true`, any previous requests to same API endpoint will be cancelled, if a subsequent request is made meanwhile. This helps you avoid unnecessary requests to the backend.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| rejectCancelled   | boolean            | false                                    | If `true` and request is set to `cancellable`, a cancelled requests' promise will be rejected. By default, instead of rejecting the promise, `defaultResponse` is returned.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| flattenResponse   | boolean            | false                                    | Flatten nested response data, so you can avoid writing `response.data.data` and obtain response directly. Response is flattened when there is a "data" within response "data", and no other object properties set.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| defaultResponse   | any                | null                                     | Default response when there is no data or when endpoint fails depending on the chosen `strategy`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| timeout           | int                | 30000                                    | You can set a request timeout for all requests or particular in milliseconds.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| onRequest         | function(config)   |                                          | You can specify a function that will be triggered before the request is sent. The request configuration object will be sent as the first argument of the function. This is useful for modifying request parameters, headers, etc.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| onResponse        | function(response) |                                          | You can specify a function that will be triggered when the endpoint successfully responds. The full Response Object is sent as the first argument of the function. This is useful for handling the response data, parsing, and error handling based on status codes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| onError           | function(error)    |                                          | You can specify a function or class that will be triggered when endpoint fails. If it's a class it should expose a `process` method. When using native fetch(), the full Response Object is sent as a first argument of the function. In case of Axios, AxiosError object is sent.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| logger            | object             |                                          | You can additionally specify logger object with your custom logger to automatically log the errors to the console. It should contain at least `error` and `warn` functions. `console.log` is used by default.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| method            | string             | get                                      | Default request method e.g. GET, POST, DELETE, PUT etc.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| url               | string             |                                          | URL path e.g. /user-details/get                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| urlPathParams     | object             | {}                                       | An object representing URL path parameters. These parameters are used to dynamically replace placeholders in the URL path. For example, if your URL contains a placeholder like `/users/:userId`, you can provide an object with the `userId` key to replace that placeholder with an actual value. The keys in the `urlPathParams` object should match the placeholders in the URL. This allows for dynamic URL construction based on runtime values.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| retry             | object             |                                          | The object with retry settings available below.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| retry.retries     | number             | 0                                        | The number of times to retry the request in case of failure. If set to `0` (default), no retries will be attempted.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| retry.delay       | number             | 1000                                     | The initial delay (in milliseconds) between retry attempts.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| retry.backoff     | number             | 1.5                                      | The backoff factor to apply to the delay between retries. For example, if the delay is 100ms and the backoff is 1.5, the next delay will be 150ms, then 225ms, and so on.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| retry.maxDelay    | number             | 30000                                    | The maximum delay (in milliseconds) between retry attempts.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| retry.retryOn     | array              | [408, 409, 425, 429, 500, 502, 503, 504] | An array of HTTP status codes on which to retry the request. Default values include: 408 (Request Timeout), 409 (Conflict), 425 (Too Early), 429 (Too Many Requests), 500 (Internal Server Error), 502 (Bad Gateway), 503 (Service Unavailable), 504 (Gateway Timeout).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| retry.shouldRetry | async function     |                                          | A custom asynchronous function to determine whether to retry the request. It receives two arguments: `error` (the error object) and `attempts` (the number of attempts made so far).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

## ✔️ Full TypeScript support

Axios-multi-api includes all necessary [TypeScript](http://typescriptlang.org) definitions bringing full TypeScript support to your API Handler. The package ships interfaces with responsible defaults making it easier to add new endpoints.

### Example of interfaces

```typescript
import type { DefaultEndpoints } from 'axios-multi-api';
import { createApiFetcher } from 'axios-multi-api';

interface Book {
  id: number;
  title: string;
  rating: number;
}

interface Books {
  books: Book[];
  totalResults: number;
}

interface BookQueryParams {
  newBook: boolean;
}

interface BookPathParams {
  bookId?: number;
}

const endpoints = {
  fetchBooks: {
    url: 'books',
  },
  fetchBook: {
    url: 'books/:bookId',
  },
};

// Note how you don't need to specify all endpoints for typings here. The "fetchBooks" is inferred
interface EndpointsList {
  fetchBook: Endpoint<Book, BookQueryParams, BookPathParams>;
}

const api = createApiFetcher<EndpointsList, typeof endpoints>({
  apiUrl: 'https://example.com/api/',
  endpoints,
});

// Fetch book
const book = await api.fetchBook({ newBook: true }, { bookId: 1 });

// Will return an error since "rating" does not exist in "BookQueryParams"
const _book = await api.fetchBook({ rating: 5 });

// You can also pass generic type directly to the request
const books = await api.fetchBooks<Books>();
```

## ✔️ More examples

Check [examples.ts file](./docs/examples/examples.ts) for more examples of usage.

### All settings

Here’s an example of configuring and using the `createApiFetcher()` with all available settings.

```typescript
const api = createApiFetcher({
  baseURL: 'https://api.example.com/',
  retry: retryConfig,
  endpoints: {
    getBooks: {
      url: 'books/all',
    },
  },
  fetcher: require('axios'), // Use Axios for requests. If you pass Axios, you can also add all its settings here.
  strategy: 'reject', // Error handling strategy.
  cancellable: false, // If true, cancels previous requests to same endpoint.
  rejectCancelled: false, // Reject promise for cancelled requests.
  flattenResponse: false, // If true, flatten nested response data.
  defaultResponse: null, // Default response when there is no data or endpoint fails.
  timeout: 30000, // Request timeout in milliseconds.
  method: 'get', // Default request method.
  onError(error) {
    // Interceptor on error
    console.error('Request failed', error);
  },
  async onRequest(config) {
    // Interceptor on each request
    console.error('Fired on each request', config);

    return config;
  },
  async onResponse(response) {
    // Interceptor on each response
    console.error('Fired on each response', response);

    return response;
  },
  logger: {
    // Custom logger for logging errors.
    error(...args) {
      console.log('My custom error log', ...args);
    },
    warn(...args) {
      console.log('My custom warning log', ...args);
    },
  },
  retry: {
    retries: 3, // Number of retries on failure.
    delay: 1000, // Initial delay between retries in milliseconds.
    backoff: 1.5, // Backoff factor for retry delay.
    maxDelay: 30000, // Maximum delay between retries in milliseconds.
    retryOn: [408, 409, 425, 429, 500, 502, 503, 504], // HTTP status codes to retry on.
    shouldRetry: async (error, attempts) => {
      // Custom retry logic.
      return (
        attempts < 3 &&
        [408, 500, 502, 503, 504].includes(error.response.status)
      );
    },
  },
});

try {
  // The same API config as used above, except the "endpoints" and "fetcher" and fetcher could be used as 3rd argument of the api.getBooks()
  const { data } = await api.getBooks();
  console.log('Request succeeded:', data);
} catch (error) {
  console.error('Request ultimately failed:', error);
}
```

### Retry Mechanism

Here’s an example of configuring and using the `createApiFetcher()` with the retry mechanism:

```typescript
const retryConfig = {
  retries: 3,
  delay: 100,
  maxDelay: 5000,
  backoff: 1.5,
  retryOn: [500, 503],
  shouldRetry(error, attempt) {
    // Retry on specific errors or based on custom logic
    return attempt < 3; // Retry up to 3 times
  },
};

const api = createApiFetcher({
  baseURL: 'https://api.example.com/',
  retry: retryConfig,
  endpoints: {
    getBooks: {
      url: 'books/all',
    },
  },
  onError(error) {
    console.error('Request failed:', error);
  },
});

try {
  const { data } = await api.getBooks();
  console.log('Request succeeded:', data);
} catch (error) {
  console.error('Request ultimately failed:', error);
}
```

### ✔️ Advanced Usage with TypeScript and custom headers

```typescript
import axios from 'axios';
import { createApiFetcher } from 'axios-multi-api';

const endpoints = {
  getPosts: {
    url: '/posts/:subject',
  },

  getUser: {
    // Generally there is no need to specify method: 'get' for GET requests as it is default one. It can be adjusted using global "method" setting
    method: 'get',
    url: '/user-details',
  },

  updateUserDetails: {
    method: 'post',
    url: '/user-details/update/:userId',
    strategy: 'defaultResponse',
  },
};

interface EndpointsList {
  getPosts: Endpoint<PostsResponse, PostsQueryParams, PostsPathParams>;
}

const api = createApiFetcher<EndpointsList, typeof endpoints>({
  apiUrl: 'https://example.com/api',
  fetcher: axios,
  endpoints,
  onError(error) {
    console.log('Request failed', error);
  },
  headers: {
    'my-auth-key': 'example-auth-key-32rjjfa',
  },
  // Optional: Whole Axios config is supported here
});

// Fetch user data - "data" will return data directly
// GET to: http://example.com/api/user-details?userId=1&ratings[]=1&ratings[]=2
const { data } = await api.getUser({ userId: 1, ratings: [1, 2] });

// Fetch posts - "data" will return data directly
// GET to: http://example.com/api/posts/myTestSubject?additionalInfo=something
const { data } = await api.getPosts(
  { additionalInfo: 'something' },
  { subject: 'test' },
);

// Send POST request to update userId "1"
await api.updateUserDetails({ name: 'Mark' }, { userId: 1 });

// Send POST request to update array of user ratings for userId "1"
await api.updateUserDetails({ name: 'Mark', ratings: [1, 2] }, { userId: 1 });
```

In the example above we fetch data from an API for user with an ID of 1. We also make a GET request to fetch some posts, update user's name to Mark. If you want to use more strict typings, please check TypeScript Usage section below.

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

      // You can also specify strategy and other settings in global list of endpoints, but just for this endpoint
      // strategy: 'defaultResponse',
    },
  },
});

async function sendMessage() {
  const { data } = await api.sendMessage(
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

  if (data === null) {
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

      // You can also specify strategy and other settings in global list of endpoints, but just for this endpoint
      // strategy: 'silent',
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

### fetchf() usage with retries

```typescript
import { fetchf } from 'axios-multi-api';

const { data } = await fetchf('/api/user-details', {
  retry: { retries: 3, delay: 2000 },
});
```

## ✔️ Support and collaboration

If you have any idea for an improvement, please file an issue. Feel free to make a PR if you are willing to collaborate on the project. Thank you :)

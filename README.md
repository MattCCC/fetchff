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
const data = await api.getUser({ userId: 1, ratings: [1, 2] });
```

Standalone usage: (without endpoints):

```typescript
import { fetchf } from 'axios-multi-api';

const data = await fetchf('/api/user-details');
```

## ✔️ Advanced Usage

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

const api = createApiFetcher({
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
const data = await api.getUser({ userId: 1, ratings: [1, 2] });

// Fetch posts - "data" will return data directly
// GET to: http://example.com/api/posts/myTestSubject?additionalInfo=something
const data = await api.getPosts(
  { additionalInfo: 'something' },
  { subject: 'test' },
);

// Send POST request to update userId "1"
await api.updateUserDetails({ name: 'Mark' }, { userId: 1 });

// Send POST request to update array of user ratings for userId "1"
await api.updateUserDetails({ name: 'Mark', ratings: [1, 2] }, { userId: 1 });
```

In the example above we fetch data from an API for user with an ID of 1. We also make a GET request to fetch some posts, update user's name to Mark. If you want to use more strict typings, please check TypeScript Usage section below.

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

## ✔️ fetchf() = improved native fetch() wrapper

The `axios-multi-api` wraps the endpoints around and automatically uses `fetchf()` under the hood. However, you can use `fetchf()` directly just like you use `fetch()`.

### Improvements to native fetch

To address these challenges, the `fetchf()` provides several enhancements:

1. **Consistent Error Handling:**

   - The `RequestHandler` ensures that HTTP error statuses (e.g., 404, 500) are treated as errors. This is achieved by wrapping `fetch()` in a way that checks the response status and throws an exception if the `ok` property is `false`.
   - This approach aligns error handling with common practices and makes it easier to manage errors in a consistent manner.

2. **Enhanced Retry Mechanism:**

   - **Retry Configuration:** You can configure the number of retries, delay between retries, and exponential backoff for failed requests. This helps to handle transient errors effectively.
   - **Custom Retry Logic:** The `shouldRetry` function allows for custom retry logic based on the error and attempt count, providing flexibility to handle different types of failures.

3. **Improved Error Visibility:**

   - **Error Wrapping:** The `RequestHandler` wraps errors in a custom `RequestError` class, which provides detailed information about the request and response. This makes debugging easier and improves visibility into what went wrong.
   - **Retry Conditions:** Errors are only retried based on configurable retry conditions, such as specific HTTP status codes or error types.

4. **Functional `fetchf()` Wrapper:**
   - **Wrapper Function:** `fetchf()` is a functional wrapper for `fetch()` provided by `RequestHandler`. It integrates seamlessly with the retry mechanism and error handling improvements.
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

- **`delay`**: Initial delay (in milliseconds) before the first retry attempt. Subsequent retries use an exponentially increasing delay based on the `backoff` parameter. Default is `100`.

- **`maxDelay`**: Maximum delay (in milliseconds) between retry attempts. The delay will not exceed this value, even if the exponential backoff would suggest a longer delay. Default is `5000`.

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

### Example Usage

Here’s an example of configuring and using the `RequestHandler` with the retry mechanism:

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

const requestHandler = new RequestHandler({
  baseURL: 'https://api.example.com',
  retry: retryConfig,
  onError(error) {
    console.error('Request failed:', error);
  },
});

try {
  const response = await fetchf('/endpoint');
  console.log('Request succeeded:', response);
} catch (error) {
  console.error('Request ultimately failed:', error);
}
```

## ✔️ Settings

Global settings are passed to `createApiFetcher()` function. Settings that are global only are market with star `*` next to setting name.

You can pass settings on per-request basis in the 3rd argument of endpoint function, for example `api.getUser({}, {}, { /* settings */ })`.

You can also pass all `fetch()` settings, or if you use Axios, you can pass all [Axios Request Config](https://github.com/axios/axios#request-config).

| Setting         | Type        | Default   | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --------------- | ----------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| apiUrl \*       | string      |           | Your API base url.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| endpoints \*    | object      |           | List of your endpoints. Each endpoint accepts all these settings. They can be set globally or per-endpoint when they are called.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| fetcher \*      | AxiosStatic | `fetch`   | The native `fetch()` is used by default. Axios instance imported from axios package can be used otherwise. Leave as is, if you do not intend to use Axios.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| strategy        | string      | `reject`  | Error handling strategies - basically what to return when an error occurs. It can be a default data, promise can be hanged (nothing would be returned) or rejected so to use try/catch.<br><br>Available: `silent`, `reject`, `defaultResponse`.<br><br>`reject` - standard way - simply rejects the promise. Global error handling is triggered right before the rejection. You need to set try/catch to catch errors.<br><br>`defaultResponse` in case of an error, it returns default response specified in global `defaultResponse` or per endpoint `defaultResponse` setting. Promise will not be rejected! Data from default response will be returned instead. It could be used together with object destructuring by setting `defaultResponse: {}` so to provide a responsible defaults.<br><br>`silent` can be used for requests that are dispatched within asynchronous wrapper functions that are not awaited. If a request fails, promise will silently hang and no action will be performed. In case of an error, the promise will never be resolved or rejected, and any code after will never be executed. If used properly it saves developers from try/catch or additional response data checks everywhere. You can use is in combination with `onError` so to handle errors globally. |
| cancellable     | boolean     | `false`   | If `true`, any previous requests to same API endpoint will be cancelled, if a subsequent request is made meanwhile. This helps you avoid unnecessary requests to the backend.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| rejectCancelled | boolean     | `false`   | If `true` and request is set to `cancellable`, a cancelled requests' promise will be rejected. By default, instead of rejecting the promise, `defaultResponse` is returned.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| flattenResponse | boolean     | `true`    | Flatten nested response data, so you can avoid writing `response.data.data` and obtain response directly. Response is flattened when there is a "data" within response "data", and no other object properties set.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| defaultResponse | any         | `null`    | Default response when there is no data or when endpoint fails depending on the chosen `strategy`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| timeout         | int         | `30000`   | You can set a request timeout for all requests or particular in milliseconds.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| onError         | function    |           | You can specify a function or class that will be triggered when endpoint fails. If it's a class it should expose a `process` method. When using native fetch(), the full Response Object is sent as a first argument of the function. In case of Axios, AxiosError object is sent.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| logger          | object      | `console` | You can additionally specify logger object with your custom logger to automatically log the errors to the console. It should contain at least `error` and `warn` functions. `console.log` is used by default.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| method          | string      | `get`     | Default request method e.g. GET, POST, DELETE, PUT etc.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| url             | string      |           | URL path e.g. /user-details/get                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

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
interface EndpointsList extends DefaultBookQueryParams<typeof endpoints> {
  fetchBook: Endpoint<Book, BookQueryParams, BookPathParams>;
}

const api = createApiFetcher<EndpointsList>({
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

const data = await fetchf('/api/user-details', {
  retry: { retries: 3, delay: 2000 },
});
```

### OOP style custom Error Handler and Axios

You could for example create an API and, inject an error service class to handle with a store that would collect the errors.

As you may notice there's also am `api.getInstance()` exposed. You can operate on it instead of requesting an Axios instance prior the operation. This way you can use all Axios settings for a particular API handler.

```typescript
import axios from 'axios';

class MyRequestError {
  public constructor(myCallback) {
    this.myCallback = myCallback;
  }

  public process(error) {
    this.myCallback('Request error', error);
  }
}

const api = createApiFetcher({
  fetcher: axios,
  apiUrl,
  endpoints,
  logger,
  onError: new MyRequestError(myCallback),
});

// Set some Axios interceptors by accessing Axios instance directly
const AxiosInstance = api.getInstance();

AxiosInstance.interceptors.request.use(onRequest);
```

## ✔️ Support and collaboration

If you have any idea for an improvement, please file an issue. Feel free to make a PR if you are willing to collaborate on the project. Thank you :)

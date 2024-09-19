<img src="./docs/logo.png" alt="logo" width="380"/>

<b>Fast, lightweight and reusable data fetching</b>

[npm-url]: https://npmjs.org/package/fetchff
[npm-image]: http://img.shields.io/npm/v/fetchff.svg

[![NPM version][npm-image]][npm-url] [![Blazing Fast](https://badgen.now.sh/badge/speed/blazing%20%F0%9F%94%A5/green)](https://github.com/MattCCC/fetchff) [![Code Coverage](https://img.shields.io/badge/coverage-97.39-green)](https://github.com/MattCCC/fetchff) [![npm downloads](https://img.shields.io/npm/dm/fetchff.svg?color=lightblue)](http://npm-stat.com/charts.html?package=fetchff) [![gzip size](https://img.shields.io/bundlephobia/minzip/fetchff)](https://bundlephobia.com/result?p=fetchff)

## Why?

Managing multiple API endpoints can be complex and time-consuming. `fetchff` simplifies this process by offering a straightforward, declarative approach to API handling using Repository Pattern. It reduces the need for extensive setup and middlewares, allowing developers to focus on data manipulation and application logic.

**Key Benefits:**

**✅ Simplicity:** Minimal code footprint for managing extensive APIs.

**✅ Productivity:** Streamlines API interactions, enhancing developer efficiency.

**✅ Scalability:** Easily scales from a few endpoints to complex API networks.

## Features

- **100% Performance-Oriented**: Optimized for speed and efficiency, ensuring fast and reliable API interactions.
- **Fully TypeScript Compatible**: Enjoy full TypeScript support for better development experience and type safety.
- **Smart Error Retry**: Features exponential backoff for intelligent error handling and retry mechanisms.
- **Automatic Request Deduplication**: Set the time during which requests are deduplicated (treated as same request).
- **Dynamic URLs Support**: Easily manage routes with dynamic parameters, such as `/user/:userId`.
- **Native `fetch()` Support**: Uses the modern `fetch()` API by default, eliminating the need for libraries like Axios.
- **Global and Per Request Error Handling**: Flexible error management at both global and individual request levels.
- **Automatic Request Cancellation**: Utilizes `AbortController` to cancel previous requests automatically.
- **Global and Per Request Timeouts**: Set timeouts globally or per request to prevent hanging operations.
- **Multiple Fetching Strategies**: Handle failed requests with various strategies - promise rejection, silent hang, soft fail, or default response.
- **Multiple Requests Chaining**: Easily chain multiple requests using promises for complex API interactions.
- **Supports All Axios Options**: Fully compatible with all Axios configuration options for seamless integration.
- **Lightweight**: Minimal footprint, only a few KBs when gzipped, ensuring quick load times.
- **Framework Independent**: Pure JavaScript solution, compatible with any framework or library.
- **Browser and Node 18+ Compatible**: Works flawlessly in both modern browsers and Node.js environments.
- **Custom Interceptors**: Includes `onRequest`, `onResponse`, and `onError` interceptors for flexible request and response handling.

Please open an issue for future requests.

## ✔️ Quick Start

[![NPM](https://nodei.co/npm/fetchff.png)](https://npmjs.org/package/fetchff)

Using NPM:

```bash
npm install fetchff
```

Using Pnpm:

```bash
pnpm install fetchff
```

Using Yarn:

```bash
yarn add fetchff
```

### Standalone usage

```typescript
import { fetchf } from 'fetchff';

const { data, error, status } = await fetchf(
  'https://example.com/api/v1/books',
  {
    timeout: 2000,
    // Specify some other settings here...
  },
);
```

### Multiple API Endpoints

```typescript
import { createApiFetcher } from 'fetchff';

const api = createApiFetcher({
  apiUrl: 'https://example.com/api',
  strategy: 'softFail', // no try/catch required
  // Other global settings...
  endpoints: {
    getUser: {
      method: 'get',
      url: '/user-details',
      // All global settings can be added per endpoint...
    },
  },
});

// GET request to http://example.com/api/user-details?userId=1
const { data } = await api.getUser({ userId: 1 });

// GET request to http://example.com/api/user-details?userId=2&ratings[]=1&ratings[]=2
const { data, error, status } = await api.getUser({
  userId: 2,
  ratings: [1, 2],
});
```

## ✔️ Easy Integration with React and Other Libraries

`fetchff` is designed to seamlessly integrate with any popular libraries like React, Vue, React Query and SWR. It is written in pure JS so you can effortlessly manage API requests with minimal setup, and without any dependencies.

### 🌊 Using with React

You can implement a `useApi()` hook to handle the data fetching. Since this package has everything included, you don't really need anything more than a simple hook to utilize.

```typescript
import { createApiFetcher } from 'fetchff';

const api = createApiFetcher({
  apiUrl: 'https://example.com/api',
  strategy: 'softFail',
  endpoints: {
    getProfile: {
      url: '/profile/:id',
    },
  },
});

export const useApi = (apiFunction) => {
  const [data, setData] = useState(null);
  const [error,] = useState(null);
  const [isLoading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      const { data, error } = await apiFunction();

      if (error) {
          setError(error);
      } else {
          setData(data);
      }

      setLoading(false);
    };

    fetchData();
  }, [apiFunction]);

  return {data, error, isLoading, setData};
};

const ProfileComponent = ({ id }) => {
  const { data: profile, error, isLoading } = useApi(() => api.getProfile({ id }));

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <div>{JSON.stringify(profile)}</div>;
};

```

#### Using with React Query

Integrate `fetchff` with React Query to streamline your data fetching:

```typescript
import { createApiFetcher } from 'fetchff';

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

#### Using with SWR

Combine `fetchff` with SWR for efficient data fetching and caching:

```typescript
import { createApiFetcher } from 'fetchff';
import useSWR from 'swr';

const api = createApiFetcher({
  apiUrl: 'https://example.com/api',
  endpoints: {
    getProfile: {
      url: '/profile/:id',
    },
  },
});

export const useProfile = ({ id }) => {
  const fetcher = () => api.getProfile({ id });

  const { data, error } = useSWR(['profile', id], fetcher);

  return {
    profile: data,
    isLoading: !error && !data,
    isError: error,
  };
};
```

Check examples below for more integrations with other libraries.

## ✔️ API

### `fetchf()`

`fetchf()` is a functional wrapper for `fetch()`. It integrates seamlessly with the retry mechanism and error handling improvements. Unlike the traditional class-based approach, `fetchf()` can be used directly as a function, simplifying the usage and making it easier to integrate with functional programming styles.

```typescript
import { fetchf } from 'fetchff';

const { data, error } = await fetchf('/api/user-details', {
  timeout: 5000,
  cancellable: true,
  retry: { retries: 3, delay: 2000 },
  // All other fetch() settings work as well...
});
```

> The fetchf() makes requests independently from createApiFetcher()

**Challenges with Native Fetch:**

- **Error Status Handling:** Fetch does not throw errors for HTTP error statuses, making it difficult to distinguish between successful and failed requests based on status codes alone.
- **Error Visibility:** Error responses with status codes like 404 or 500 are not automatically propagated as exceptions, which can lead to inconsistent error handling.

To address these challenges, the `fetchf()` provides several enhancements:

1. **Consistent Error Handling:**

   - In JavaScript, the native `fetch()` function does not reject the Promise for HTTP error statuses such as 404 (Not Found) or 500 (Internal Server Error). Instead, `fetch()` resolves the Promise with a `Response` object, where the `ok` property indicates the success of the request. If the request encounters a network error or fails due to other issues (e.g., server downtime), `fetch()` will reject the Promise.
   - This approach aligns error handling with common practices and makes it easier to manage errors consistently.

2. **Enhanced Retry Mechanism:**

   - **Retry Configuration:** You can configure the number of retries, delay between retries, and exponential backoff for failed requests. This helps to handle transient errors effectively.
   - **Custom Retry Logic:** The `shouldRetry` asynchronous function allows for custom retry logic based on the error and attempt count, providing flexibility to handle different types of failures.
   - **Retry Conditions:** Errors are only retried based on configurable retry conditions, such as specific HTTP status codes or error types.

3. **Improved Error Visibility:**

   - **Error Wrapping:** The `createApiFetcher()` and `fetchf()` wrap errors in a custom `RequestError` class, which provides detailed information about the request and response, similarly to what Axios does. This makes debugging easier and improves visibility into what went wrong.

4. **Extended settings:**
   - Check Settings table for more information about all settings.

### `createApiFetcher()`

`createApiFetcher()` is a powerful factory function for creating API fetchers with advanced features. It provides a convenient way to configure and manage multiple API endpoints using a declarative approach. This function offers integration with retry mechanisms, error handling improvements, and other advanced configurations. Unlike traditional methods, `createApiFetcher()` allows you to set up and use API endpoints efficiently with minimal boilerplate code.

#### Usage Example

```typescript
import { createApiFetcher } from 'fetchff';

const api = createApiFetcher({
  apiUrl: 'https://example.com/api',
  endpoints: {
    getUserDetails: {
      url: '/user-details',
      method: 'GET',
      retry: { retries: 3, delay: 2000 },
      timeout: 5000,
      cancellable: true,
      strategy: 'softFail',
    },
    updateUser: {
      url: '/update-user',
      method: 'POST',
      retry: { retries: 2, delay: 1000 },
    },
    // Define more endpoints as needed
  },
});

// Example usage
const { data, error } = await api.getUserDetails();
```

The `const api` methods and properties are described below:

#### `api.myEndpointName(queryParams, urlPathParams, requestConfig)`

Where "myEndpointName" is the name of your endpoint from `endpoints` object passed to the `createApiFetcher()`.

**`queryParams`** / **`bodyPayload`** (optional) - Query Parameters or Body Payload for POST requests.

The first argument of API functions is an object that can serve different purposes based on the type of request being made:

- For `GET` and `HEAD` Requests: This object will be treated as query parameters. You can pass key-value pairs where the values can be strings, numbers, or arrays. For example, if you pass { foo: [1, 2] }, it will be automatically serialized into foo[]=1&foo[]=2 in the URL.

- For `POST` (and similar) Requests: This object is used as the data payload. It will be sent in the body of the request. If your request also requires query parameters, you can still pass those in the first argument and then use the requestConfig.body or requestConfig.data for the payload.

**Note:** If you need to use Query Params in the `POST` (and similar) requests, you can pass them in this argument and then use `body` or `data` in `requestConfig` (third argument).

**`urlPathParams`** (optional) - Dynamic URL Path Parameters

The urlPathParams option allows you to dynamically replace parts of your URL with specific values in a declarative and straightforward way. This feature is particularly useful when you need to construct URLs that include variables or identifiers within the path.

For example, consider the following URL template: /user-details/update/:userId. By using urlPathParams, you can easily replace :userId with an actual value when the API request is made.

**`requestConfig`** (optional) - Request Configuration to overwrite global config in case
To have more granular control over specific endpoints you can pass Request Config for particular endpoint. See the Settings below for more information.

Returns: **`response`** or **`data`** object, depending on `flattenResponse` setting.

##### Response Object without `flattenResponse` (default)

When `flattenResponse` is disabled, the response object includes a more detailed structure, encapsulating various aspects of the response:

- **`data`**:

  - Contains the actual data returned from the API request.

- **`error`**:

  - An object with details about any error that occurred or `null` otherwise.
  - **`name`**: The name of the error (e.g., 'ResponseError').
  - **`message`**: A descriptive message about the error.
  - **`status`**: The HTTP status code of the response (e.g., 404, 500).
  - **`statusText`**: The HTTP status text of the response (e.g., 'Not Found', 'Internal Server Error').
  - **`request`**: Details about the HTTP request that was sent (e.g., URL, method, headers).
  - **`config`**: The configuration object used for the request, including URL, method, headers, and query parameters.
  - **`response`**: The full response object received from the server, including all headers and body.

- **`config`**:

  - The configuration object with all settings used for the request, including URL, method, headers, and query parameters.

- **`request`**:

  - An alias for `config`.

- **`headers`**:
  - The response headers returned by the server, such as content type and caching information returned as simple key-value object.

##### Response Object with `flattenResponse`

When the `flattenResponse` option is enabled, the `data` from the API response is directly exposed as the top-level property of the response object. This simplifies access to the actual data, as it is not nested within additional response metadata.

##### Key Points

- **With `flattenResponse` Enabled**:

  - **`data`**: Directly contains the API response data.

- **With `flattenResponse` Disabled**:
  - **`data`**: Contains the API response data nested within a broader response structure.
  - **`error`**: Provides detailed information about any errors encountered.
  - **`config`**: Shows the request configuration.
  - **`request`**: Details the actual HTTP request sent.
  - **`headers`**: Includes the response headers from the server.

The `flattenResponse` option provides a more streamlined response object by placing the data directly at the top level, while disabling it gives a more comprehensive response structure with additional metadata.

#### `api.config`

You can access `api.config` property directly, so to modify global headers, and other settings on fly. Please mind it is a property, not a function.

#### `api.endpoints`

You can access `api.endpoints` property directly, so to modify endpoints list. It can be useful if you want to append or remove global endpoints. Please mind it is a property, not a function.

#### `api.getInstance()`

When API handler is firstly initialized, a new custom `fetcher` instance is created. You can call `api.getInstance()` if you want to get that instance directly, for example to add some interceptors. The instance of `fetcher` is created using `fetcher.create()` functions. Your fetcher can include anything. It will be triggered instead of native fetch() that is available by default.

#### `api.request()`

The `api.request()` helper function is a versatile method provided for making API requests with customizable configurations. It allows you to perform HTTP requests to any endpoint defined in your API setup and provides a straightforward way to handle queries, path parameters, and request configurations dynamically.

##### Example

```typescript
import { createApiFetcher } from 'fetchff';

const api = createApiFetcher({
  apiUrl: 'https://example.com/api',
  endpoints: {
    getUserDetails: {
      url: '/user-details/:id',
      method: 'GET',
    },
    updateUser: {
      url: '/update-user',
      method: 'POST',
    },
    // Define more endpoints as needed
  },
});

// Using api.request to make a GET request
const { data, error } = await api.request(
  'getUserDetails',
  null, // no Query Params passed
  {
    id: '123', // URL Path Param :id
  },
);

// Using api.request to make a POST request
const { data, error } = await api.request('updateUser', {
  name: 'John Doe', // Data Payload
});

// Using api.request to make a GET request to an external API
const { data, error } = await api.request('https://example.com/api/user', {
  name: 'John Smith', // Query Params
});
```

## ✔️ Settings (Request Config)

You can pass the settings:

- globally for all requests when calling `createApiFetcher()`
- per-endpoint basis defined under `endpoints` in global config when calling `createApiFetcher()`
- per-request basis as a 3rd argument when calling `fetchff()` or the `api.yourEndpoint()`

You can also use all native `fetch()` settings.

Settings that are global only are marked with star `*`.

|                               | Type                                                                                     | Default                                  | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| baseURL \*<br>(alias: apiUrl) | string                                                                                   |                                          | Your API base url.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| endpoints \*                  | object                                                                                   |                                          | List of your endpoints. Each endpoint accepts all these settings. They can be set globally or per-endpoint when they are called.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| fetcher \*                    | Function                                                                                 | fetch                                    | The native `fetch()` is used by default. A custom instance that exposes create() and request() can be used otherwise.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| url                           | string                                                                                   |                                          | URL path e.g. /user-details/get                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| method                        | string                                                                                   | get                                      | Default request method e.g. GET, POST, DELETE, PUT etc.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| params                        | object<br>URLSearchParams                                                                | {}                                       | A key-value pairs added to the URL to send extra information with a request. If you pass an object, it will be automatically converted. It works with nested objects, arrays and custom data structures. If you use `createApiFetcher()` then it is the first argument of your api.endpoint() function. You can still pass configuration in 3rd argument if necessary.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| body<br>(alias: data)         | object<br>string<br>FormData<br>URLSearchParams<br>Blob<br>ArrayBuffer<br>ReadableStream | {}                                       | The body is the data sent with the request, such as JSON, text, or form data, included in the request payload for POST, PUT, or PATCH requests.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| urlPathParams                 | object                                                                                   | {}                                       | An object with URL path parameters so to dynamically replace placeholders in the URL path. For example, if URL contains a placeholder like `/users/:userId`, you can provide an object with the `userId` key to replace that placeholder with an actual value. The keys in the `urlPathParams` object should match the placeholders in the URL. This allows for dynamic URL construction based on runtime values.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| strategy                      | string                                                                                   | reject                                   | Error handling strategies - basically what to return when an error occurs. It can be a default data, promise can be hanged (nothing would be returned) or rejected so to use try/catch.<br><br>Available: `reject`, `softFail`, `defaultResponse`, `silent`.<br><br>`reject` - Promises are rejected, and global error handling is triggered. Requires try/catch for handling.<br><br>`softFail` - returns a response object with additional properties such as `data`, `error`, `config`, `request`, and `headers` when an error occurs. This approach avoids throwing errors, allowing you to handle error information directly within the response object without the need for try/catch blocks.<br><br>`defaultResponse` - returns default response specified in case of an error. Promise will not be rejected. It could be used in conjuction with `flattenResponse` and as `defaultResponse: {}` so to provide a sensible defaults.<br><br>`silent` - hangs the promise silently on error, useful for fire-and-forget requests without the need for try/catch. In case of an error, the promise will never be resolved or rejected, and any code after will never be executed. The requests could be dispatched within an asynchronous wrapper functions that do not need to be awaited. If used properly, it prevents excessive usage of try/catch or additional response data checks everywhere. You can use it in combination with `onError` to handle errors separately. |
| cancellable                   | boolean                                                                                  | false                                    | If `true`, any ongoing previous requests to same API endpoint will be cancelled, if a subsequent request is made meanwhile. This helps you avoid unnecessary requests to the backend.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| rejectCancelled               | boolean                                                                                  | false                                    | If `true` and request is set to `cancellable`, a cancelled requests' promise will be rejected. By default, instead of rejecting the promise, `defaultResponse` is returned.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| flattenResponse               | boolean                                                                                  | false                                    | Flatten nested response data, so you can avoid writing `response.data.data` and obtain response directly. Response is flattened when there is a "data" within response "data", and no other object properties set.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| defaultResponse               | any                                                                                      | null                                     | Default response when there is no data or when endpoint fails depending on the chosen `strategy`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| withCredentials               | boolean                                                                                  | false                                    | Indicates whether credentials (such as cookies) should be included with the request.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| timeout                       | int                                                                                      | 30000                                    | You can set a request timeout for all requests or particular in milliseconds.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| dedupeTime                    | int                                                                                      | 1000                                     | Time window, in milliseconds, during which identical requests are deduplicated (treated as single request).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| onRequest                     | function(config)                                                                         |                                          | You can specify a function that will be triggered before the request is sent. The request configuration object will be sent as the first argument of the function. This is useful for modifying request parameters, headers, etc.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| onResponse                    | function(response)                                                                       |                                          | You can specify a function that will be triggered when the endpoint successfully responds. The full Response Object is sent as the first argument of the function. This is useful for handling the response data, parsing, and error handling based on status codes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| onError                       | function(error)                                                                          |                                          | You can specify a function or class that will be triggered when endpoint fails. If it's a class it should expose a `process` method. When using native fetch(), the full Response Object is sent as a first argument of the function.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| logger                        | object                                                                                   | null                                     | You can additionally specify logger object with your custom logger to automatically log the errors to the console. It should contain at least `error` and `warn` functions.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| retry                         | object                                                                                   |                                          | The object with retry settings available below.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| retry.retries                 | number                                                                                   | 0                                        | The number of times to retry the request in case of failure. If set to `0` (default), no retries will be attempted.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| retry.delay                   | number                                                                                   | 1000                                     | The initial delay (in milliseconds) between retry attempts.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| retry.backoff                 | number                                                                                   | 1.5                                      | The backoff factor to apply to the delay between retries. For example, if the delay is 100ms and the backoff is 1.5, the next delay will be 150ms, then 225ms, and so on.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| retry.maxDelay                | number                                                                                   | 30000                                    | The maximum delay (in milliseconds) between retry attempts.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| retry.resetTimeout            | boolean                                                                                  | true                                     | Reset timeout when retrying requests.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| retry.retryOn                 | array                                                                                    | [408, 409, 425, 429, 500, 502, 503, 504] | An array of HTTP status codes on which to retry the request. Default values include: 408 (Request Timeout), 409 (Conflict), 425 (Too Early), 429 (Too Many Requests), 500 (Internal Server Error), 502 (Bad Gateway), 503 (Service Unavailable), 504 (Gateway Timeout).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| retry.shouldRetry             | async function                                                                           |                                          | A custom asynchronous function to determine whether to retry the request. It receives two arguments: `error` (the error object) and `attempts` (the number of attempts made so far).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

## ✔️ Retry Mechanism

The exposed `fetchf()` and `createApiFetcher()` functions include a built-in retry mechanism to handle transient errors and improve the reliability of network requests. This mechanism automatically retries requests when certain conditions are met, providing robustness in the face of temporary failures. Below is an overview of how the retry mechanism works and how it can be configured.

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

## Comparison with another libraries

| Feature                                            | fetchff     | ofetch       | wretch       | axios        | native fetch() |
| -------------------------------------------------- | ----------- | ------------ | ------------ | ------------ | -------------- |
| **Unified API Client**                             | ✅          | --           | --           | --           | --             |
| **Automatic Request Deduplication**                | ✅          | --           | --           | --           | --             |
| **Built-in Error Handling**                        | ✅          | --           | ✅           | --           | --             |
| **Customizable Error Handling**                    | ✅          | --           | ✅           | ✅           | --             |
| **Retries with exponential backoff**               | ✅          | --           | --           | --           | --             |
| **Advanced Query Params handling**                 | ✅          | --           | --           | --           | --             |
| **Custom Retry logic**                             | ✅          | ✅           | ✅           | --           | --             |
| **Easy Timeouts**                                  | ✅          | ✅           | ✅           | ✅           | --             |
| **Polling Functionality**                          | ✅          | --           | --           | --           | --             |
| **Easy Cancellation of stale (previous) requests** | ✅          | --           | --           | --           | --             |
| **Default Responses**                              | ✅          | --           | --           | --           | --             |
| **Custom adapters (fetchers)**                     | ✅          | --           | --           | ✅           | --             |
| **Global Configuration**                           | ✅          | --           | ✅           | ✅           | --             |
| **TypeScript Support**                             | ✅          | ✅           | ✅           | ✅           | ✅             |
| **Built-in AbortController Support**               | ✅          | --           | --           | --           | --             |
| **Request Interceptors**                           | ✅          | ✅           | ✅           | ✅           | --             |
| **Request and Response Transformation**            | ✅          | ✅           | ✅           | ✅           | --             |
| **Integration with Libraries**                     | ✅          | ✅           | ✅           | ✅           | --             |
| **Request Queuing**                                | ✅          | --           | --           | --           | --             |
| **Multiple Fetching Strategies**                   | ✅          | --           | --           | --           | --             |
| **Dynamic URLs**                                   | ✅          | --           | ✅           | --           | --             |
| **Automatic Retry on Failure**                     | ✅          | ✅           | --           | ✅           | --             |
| **Server-Side Rendering (SSR) Support**            | ✅          | ✅           | --           | --           | --             |
| **Minimal Installation Size**                      | 🟢 (2.9 KB) | 🟡 (6.41 KB) | 🟢 (2.21 KB) | 🔴 (13.7 KB) | 🟢 (0 KB)      |

Please mind that this table is for informational purposes only. All of these solutions differ. For example `swr` and `react-query` are more focused on React, re-rendering, query caching and keeping data in sync, while fetch wrappers like `fetchff` or `ofetch` aim to extend functionalities of native `fetch` so to reduce complexity of having to maintain various wrappers.

## ✔️ Full TypeScript support

The library includes all necessary [TypeScript](http://typescriptlang.org) definitions bringing full TypeScript support to your API Handler. The package ships interfaces with responsible defaults making it easier to add new endpoints.

```typescript
// books.d.ts
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
```

```typescript
// api.ts
import type { DefaultEndpoints } from 'fetchff';
import { createApiFetcher } from 'fetchff';

const endpoints = {
  fetchBooks: {
    url: 'books',
  },
  fetchBook: {
    url: 'books/:bookId',
  },
};

// No need to specify all endpoints types. For example, the "fetchBooks" is inferred automatically.
interface EndpointsList {
  fetchBook: Endpoint<Book, BookQueryParams, BookPathParams>;
}

const api = createApiFetcher<EndpointsList, typeof endpoints>({
  apiUrl: 'https://example.com/api/',
  endpoints,
});
```

```typescript
const book = await api.fetchBook({ newBook: true }, { bookId: 1 });

// Will return an error since "rating" does not exist in "BookQueryParams"
const anotherBook = await api.fetchBook({ rating: 5 });

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
      method: 'get',
      cancellable: true,
      // All the global settings can be specified on per-endpoint basis as well
    },
  },
  strategy: 'reject', // Error handling strategy.
  cancellable: false, // If true, cancels previous requests to same endpoint.
  rejectCancelled: false, // Reject promise for cancelled requests.
  flattenResponse: false, // If true, flatten nested response data.
  defaultResponse: null, // Default response when there is no data or endpoint fails.
  withCredentials: true, // Pass cookies to all requests.
  timeout: 30000, // Request timeout in milliseconds.
  dedupeTime: 1000, // Time window, in milliseconds, during which identical requests are deduplicated (treated as single request).
  method: 'get', // Default request method.
  params: {}, // Default params added to all requests.
  data: {}, // Alias for 'body'. Default data passed to POST, PUT, DELETE and PATCH requests.
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
    resetTimeout: true, // Reset the timeout when retrying requests.
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

### Call without initializing Multiple APIs Handler

```typescript
import { fetchf } from 'fetchff';

const books = await fetchf('https://example.com/api/v1/books', {
  timeout: 2000,
  // Specify some other settings here...
});
```

### Multiple APIs Handler from different API sources

```typescript
import { createApiFetcher } from 'fetchff';

// Create fetcher instance
const api = createApiFetcher({
  baseURL: 'https://example.com/api/v1',
  endpoints: {
    sendMessage: {
      method: 'post',
      url: '/send-message/:postId',
    },
    getMessage: {
      url: '/get-message/',
      // Change baseURL to external for this endpoint onyl
      baseURL: 'https://externalprovider.com/api/v2',
    },
  },
});

// Make a wrapper function and call your API
async function sendAndGetMessage() {
  await api.sendMessage({ message: 'Text' }, { postId: 1 });

  const { data } = await api.getMessage({ postId: 1 });
}

// Invoke your wrapper function
sendAndGetMessage();
```

### Retry Mechanism

Here’s an example of configuring and using the `createApiFetcher()` with the retry mechanism:

```typescript
const retryConfig = {
  retries: 3,
  delay: 100,
  maxDelay: 5000,
  resetTimeout: true,
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

### Polling Mechanism

Standard polling - re-fetch every n seconds.

```typescript
fetchff('https://api.example.com/books/all', null, {
  pollingInterval: 5000, // Re-fetch the data every 5 seconds
  shouldStopPolling(response, error, attempt) {
    // Add some custom conditions
    return attempt < 3; // Retry up to 3 times
  },
  onResponse(response) {
    console.log('New response:', response);

    return response;
  },
  onError(error) {
    console.error('Request ultimately failed:', error);
  },
});
```

Status Polling - until you get a certain data from an API. Let's say you have an API that returns the progress of a process, and you want to call that API until the process is finished.

```typescript
try {
  const { data } = fetchff('https://api.example.com/books/all', null, {
    pollingInterval: 5000, // Poll every 5 seconds
    shouldStopPolling(response, error, attempt) {
      // Add some custom conditions
      return attempt < 3; // Retry up to 3 times
    },
  });

  console.log('Request finally succeeded:', data);
} catch (error) {
  console.error('Request ultimately failed:', error);
}
```

### ✔️ Advanced Usage with TypeScript and custom headers

```typescript
import { createApiFetcher } from 'fetchff';

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
  endpoints,
  onError(error) {
    console.log('Request failed', error);
  },
  headers: {
    'my-auth-key': 'example-auth-key-32rjjfa',
  },
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
import { createApiFetcher } from 'fetchff';

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

### Per-request Error handling - softFail strategy (recommended)

```typescript
import { createApiFetcher } from 'fetchff';

const api = createApiFetcher({
  apiUrl: 'https://example.com/api',
  strategy: 'softFail',
  endpoints: {
    sendMessage: {
      method: 'post',
      url: '/send-message/:postId',
    },
  },
});

async function sendMessage() {
  const { data, error } = await api.sendMessage(
    { message: 'Text' },
    { postId: 1 },
  );

  if (error) {
    console.error('Request Error', error);
  } else {
    console.log('Message sent successfully');
  }
}

sendMessage();
```

### Per-request Error handling - defaultResponse strategy

```typescript
import { createApiFetcher } from 'fetchff';

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
import { createApiFetcher } from 'fetchff';

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

### Per-request Error handling

```typescript
import { createApiFetcher } from 'fetchff';

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
      onError(error) {
        console.log('Error', error.message);
        console.log(error.response.data);
        console.log(error.response.status);
        console.log(error.response.headers);
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
import { fetchf } from 'fetchff';

const { data } = await fetchf('/api/user-details', {
  retry: { retries: 3, delay: 2000 },
});
```

### Integration with Vue

```typescript
// src/api.ts
import { createApiFetcher } from 'fetchff';

const api = createApiFetcher({
  apiUrl: 'https://example.com/api',
  strategy: 'softFail',
  endpoints: {
    getProfile: { url: '/profile/:id' },
  },
});

export default api;
```

```typescript
// src/composables/useProfile.ts
import { ref, onMounted } from 'vue';
import api from '../api';

export function useProfile(id: number) {
  const profile = ref(null);
  const isLoading = ref(true);
  const isError = ref(null);

  const fetchProfile = async () => {
    const { data, error } = await api.getProfile({ id });

    if (error) isError.value = error;
    else if (data) profile.value = data;

    isLoading.value = false;
  };

  onMounted(fetchProfile);

  return { profile, isLoading, isError };
}
```

```html
<!-- src/components/Profile.vue -->
<template>
  <div>
    <h1>Profile</h1>
    <div v-if="isLoading">Loading...</div>
    <div v-if="isError">Error: {{ isError.message }}</div>
    <div v-if="profile">
      <p>Name: {{ profile.name }}</p>
      <p>Email: {{ profile.email }}</p>
    </div>
  </div>
</template>

<script lang="ts">
  import { defineComponent } from 'vue';
  import { useProfile } from '../composables/useProfile';

  export default defineComponent({
    props: { id: Number },
    setup(props) {
      return useProfile(props.id);
    },
  });
</script>
```

## ✔️ Support and collaboration

If you have any idea for an improvement, please file an issue. Feel free to make a PR if you are willing to collaborate on the project. Thank you :)

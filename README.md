<img src="./docs/logo.png" alt="logo" width="380"/>

<b>Fast, lightweight and reusable data fetching</b>

[npm-url]: https://npmjs.org/package/fetchff
[npm-image]: http://img.shields.io/npm/v/fetchff.svg

[![NPM version][npm-image]][npm-url] [![Blazing Fast](https://badgen.now.sh/badge/speed/blazing%20%F0%9F%94%A5/green)](https://github.com/MattCCC/fetchff) [![Code Coverage](https://img.shields.io/badge/coverage-96.35-green)](https://github.com/MattCCC/fetchff) [![npm downloads](https://img.shields.io/npm/dm/fetchff.svg?color=lightblue)](http://npm-stat.com/charts.html?package=fetchff) [![gzip size](https://img.shields.io/bundlephobia/minzip/fetchff)](https://bundlephobia.com/result?p=fetchff)

## Why?

Managing multitude of API connections can be complex and time-consuming. `fetchff` simplifies the process by offering a simple, declarative approach to API handling using Repository Pattern. It reduces the need for extensive setup, middlewares, retries, custom caching, and heavy plugins, and lets developers focus on data handling and application logic.

**Key Benefits:**

<b style="color:green;font-size: 24px;">✓</b> **Small:** Minimal code footprint of ~3KB gzipped for managing extensive APIs.

<b style="color:green;font-size: 24px;">✓</b> **Immutable:** Every request has its own instance.

<b style="color:green;font-size: 24px;">✓</b> **Isomorphic:** Comptabile with Node.js, Deno and modern browsers.

<b style="color:green;font-size: 24px;">✓</b> **Type Safe:** Strongly typed and written in TypeScript.

<b style="color:green;font-size: 24px;">✓</b> **Scalable:** Easily scales from a few calls to complex API networks with thousands of APIs.

<b style="color:green;font-size: 24px;">✓</b> **Tested:** Battle tested in large projects, fully covered by unit tests.

<b style="color:green;font-size: 24px;">✓</b> **Maintained:** Since 2021 publicly through Github.

## ✔️ Features

- **100% Performance-Oriented**: Optimized for speed and efficiency, ensuring fast and reliable API interactions.
- **Smart Retry Mechanism**: Features exponential backoff for intelligent error handling and retry mechanisms.
- **Automatic Request Deduplication**: Set the time during which requests are deduplicated (treated as same request).
- **Smart Cache Management**: Dynamically manage cache with configurable expiration, custom keys, and selective invalidation.
- **Dynamic URLs Support**: Easily manage routes with dynamic parameters, such as `/user/:userId`.
- **Global and Per Request Error Handling**: Flexible error management at both global and individual request levels.
- **Automatic Request Cancellation**: Utilizes `AbortController` to cancel previous requests automatically.
- **Global and Per Request Timeouts**: Set timeouts globally or per request to prevent hanging operations.
- **Multiple Fetching Strategies**: Handle failed requests with various strategies - promise rejection, silent hang, soft fail, or default response.
- **Multiple Requests Chaining**: Easily chain multiple requests using promises for complex API interactions.
- **Native `fetch()` Support**: Utilizes the built-in `fetch()` API, providing a modern and native solution for making HTTP requests.
- **Customizable**: Fully compatible with a wide range of HTTP request configuration options, allowing for flexible and detailed request customization.
- **Lightweight**: Minimal footprint, only a few KBs when gzipped, ensuring quick load times.
- **Framework Independent**: Pure JavaScript solution, compatible with any framework or library.
- **Cross-Framework compatible**: Makes it easy to integration with Frameworks and Libraries, both Client Side and Server Side.
- **Browser and Node.js 18+ Compatible**: Works flawlessly in both modern browsers and Node.js environments.
- **Fully TypeScript Compatible**: Enjoy full TypeScript support for better development experience and type safety.
- **Custom Interceptors**: Includes `onRequest`, `onResponse`, and `onError` interceptors for flexible request and response handling.

Please open an issue for future requests.

## Install

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

## ✔️ API

### Standalone usage

#### `fetchf()`

It is a functional wrapper for `fetch()`. It seamlessly enhances it with additional settings like the retry mechanism and error handling improvements. The `fetchf()` can be used directly as a function, simplifying the usage and making it easier to integrate with functional programming styles. The `fetchf()` makes requests independently of `createApiFetcher()` settings.

#### Example

```typescript
import { fetchf } from 'fetchff';

const { data, error } = await fetchf('/api/user-details', {
  timeout: 5000,
  cancellable: true,
  retry: { retries: 3, delay: 2000 },
  // Specify some other settings here... The fetch() settings work as well...
});
```

<details>
  <summary><span style="cursor:pointer">Click to expand</span></summary>
  <br>

**Some of challenges with Native Fetch that `fetchff` solves:**

- **Error Status Handling:** Fetch does not throw errors for HTTP error statuses, making it difficult to distinguish between successful and failed requests based on status codes alone.
- **Error Visibility:** Error responses with status codes like 404 or 500 are not automatically propagated as exceptions, which can lead to inconsistent error handling.
- **No Built-in Retry Mechanism:** Native `fetch()` lacks built-in support for retrying requests. Developers need to implement custom retry logic to handle transient errors or intermittent failures, which can be cumbersome and error-prone.
- **Network Errors Handling:** Native `fetch()` only rejects the Promise for network errors or failure to reach the server. Issues such as timeout errors or server unavailability do not trigger rejection by default, which can complicate error management.
- **Limited Error Information:** The error information provided by native `fetch()` is minimal, often leaving out details such as the request headers, status codes, or response bodies. This can make debugging more difficult, as there's limited visibility into what went wrong.
- **Lack of Interceptors:** Native `fetch()` does not provide a built-in mechanism for intercepting requests or responses. Developers need to manually manage request and response processing, which can lead to repetitive code and less maintainable solutions.
- **No Built-in Caching:** Native `fetch()` does not natively support caching of requests and responses. Implementing caching strategies requires additional code and management, potentially leading to inconsistencies and performance issues.

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
   </details>

### Multiple API Endpoints

#### `createApiFetcher()`

It is a powerful factory function for creating API fetchers with advanced features. It provides a convenient way to configure and manage multiple API endpoints using a declarative approach. This function offers integration with retry mechanisms, error handling improvements, and all the other settings. Unlike traditional methods, `createApiFetcher()` allows you to set up and use API endpoints efficiently with minimal boilerplate code.

#### Example

```typescript
import { createApiFetcher } from 'fetchff';

// Create some endpoints declaratively
const api = createApiFetcher({
  baseURL: 'https://example.com/api',
  endpoints: {
    getUser: {
      url: '/user-details/:id/',
      method: 'GET',
      // Each endpoint accepts all settings declaratively
      retry: { retries: 3, delay: 2000 },
      timeout: 5000,
      cancellable: true,
    },
    // Define more endpoints as needed
  },
  // You can set some settings globally. They will
  strategy: 'softFail', // no try/catch required
});

// Make a GET request to http://example.com/api/user-details/2/?rating[]=1&rating[]=2
const { data, error } = await api.getUser(
  { rating: [1, 2] }, // Append some Query Params. Passed arrays, objects etc. will be parsed automatically
  { id: 2 }, // URL Path Params, replaces :id in the URL with 2
);
```

#### Multiple API Specific Settings

<details>
  <summary><span style="cursor:pointer">Click to expand</span></summary>
  <br>

All the settings are available and can be used directly in the function or in the `endpoints` property (per-endpoint basis). There are also two extra global settings for `createApiFetcher()`:

| Name      | Type              | Default | Description                                                                                                                                                                                                                                                                |
| --------- | ----------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| endpoints | `object`          |         | List of your endpoints. Each endpoint accepts all the settings below. They can be set globally, per-endpoint or per-request.                                                                                                                                               |
| fetcher   | `FetcherInstance` |         | A custom adapter (an instance / object) that exposes `create()` function so to create instance of API Fetcher. The `create()` should return `request()` function that would be used when making the requests. The native `fetch()` is used if the fetcher is not provided. |

</details>

#### How It Works

<details>
  <summary><span style="cursor:pointer">Click to expand</span></summary>
  <br>

The `createApiFetcher()` automatically creates and returns API methods based on the `endpoints` object provided. It also exposes some extra methods and properties that are useful to handle global config, dynamically add and remove endpoints etc.

#### `api.myEndpointName(queryParamsOrBodyPayload, urlPathParams, requestConfig)`

Where `myEndpointName` is the name of your endpoint from `endpoints` object passed to the `createApiFetcher()`.

**`queryParamsOrBodyPayload`** (optional) `object`, `URLSearchParams`, `NameValuePair[]` - Query Parameters or Body Payload.

- For `GET` and `HEAD` Requests: This object is treated as query parameters.

- For `POST` and all other Requests: This object is used for the data payload sent in the body of the request.

**Note:** If you need to use Query Params in the `POST` (and similar) requests, you can pass them, and then use `body` in `requestConfig` for the payload.

**`urlPathParams`** (optional) `object` - Dynamic URL Path Parameters, so to replace URL path with some data. Check [Basic Settings](#⚙️-basic-settings) below for more information.

**`requestConfig`** (optional) `object` - To have more granular control over specific endpoints you can pass Request Config for particular endpoint. Check [Basic Settings](#⚙️-basic-settings) below for more information.

Returns: [Response Object](#📄-response-object) (see below).

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
    updateUserData: {
      url: '/update-user/:id',
      method: 'POST',
    },
    // Define more endpoints as needed
  },
});

// Using api.request to make a POST request
const { data, error } = await api.request(
  'updateUserData',
  {
    name: 'John Doe', // Data Payload
  },
  {
    id: '123', // URL Path Param :id
  },
);

// Using api.request to make a GET request to an external API
const { data, error } = await api.request('https://example.com/api/user', {
  name: 'John Smith', // Query Params
});
```

</details>

## ⚙️ Basic Settings

You can pass the settings:

- globally for all requests when calling `createApiFetcher()`
- per-endpoint basis defined under `endpoints` in global config when calling `createApiFetcher()`
- per-request basis when calling `fetchf()` (second argument of the function) or in the `api.yourEndpoint()` (third argument)

You can also use all native `fetch()` settings.

|                            | Type                                                                                                   | Default | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| baseURL<br>(alias: apiUrl) | `string`                                                                                               |         | Your API base url.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| url                        | `string`                                                                                               |         | URL path e.g. /user-details/get                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| method                     | `string`                                                                                               | `GET`   | Default request method e.g. GET, POST, DELETE, PUT etc. All methods are supported.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| params                     | `object`<br>`URLSearchParams`<br>`NameValuePair[]`                                                     | `{}`    | Query Parameters - a key-value pairs added to the URL to send extra information with a request. If you pass an object, it will be automatically converted. It works with nested objects, arrays and custom data structures similarly to what `jQuery` used to do in the past. If you use `createApiFetcher()` then it is the first argument of your `api.myEndpoint()` function. You can still pass configuration in 3rd argument if want to.<br><br>You can pass key-value pairs where the values can be strings, numbers, or arrays. For example, if you pass `{ foo: [1, 2] }`, it will be automatically serialized into `foo[]=1&foo[]=2` in the URL. |
| body<br>(alias: data)      | `object`<br>`string`<br>`FormData`<br>`URLSearchParams`<br>`Blob`<br>`ArrayBuffer`<br>`ReadableStream` | `{}`    | The body is the data sent with the request, such as JSON, text, or form data, included in the request payload for POST, PUT, or PATCH requests.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| urlPathParams              | `object`                                                                                               | `{}`    | It lets you dynamically replace segments of your URL with specific values in a clear and declarative manner. This feature is especially handy for constructing URLs with variable components or identifiers.<br><br>For example, suppose you need to update user details and have a URL template like `/user-details/update/:userId`. With `urlPathParams`, you can replace `:userId` with a real user ID, such as `123`, resulting in the URL `/user-details/update/123`.                                                                                                                                                                                |
| flattenResponse            | `boolean`                                                                                              | `false` | When set to `true`, this option flattens the nested response data. This means you can access the data directly without having to use `response.data.data`. It works only if the response structure includes a single `data` property.                                                                                                                                                                                                                                                                                                                                                                                                                     |
| defaultResponse            | `any`                                                                                                  | `null`  | Default response when there is no data or when endpoint fails depending on the chosen `strategy`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| withCredentials            | `boolean`                                                                                              | `false` | Indicates whether credentials (such as cookies) should be included with the request.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| timeout                    | `number`                                                                                               | `30000` | You can set a request timeout for all requests or particular in milliseconds.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| dedupeTime                 | `number`                                                                                               | `1000`  | Time window, in milliseconds, during which identical requests are deduplicated (treated as single request).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| logger                     | `object`                                                                                               | `null`  | You can additionally specify logger object with your custom logger to automatically log the errors to the console. It should contain at least `error` and `warn` functions.                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

## 🏷️ Headers

<details>
  <summary><span style="cursor:pointer">Click to expand</span></summary>
  <br>

`fetchff` provides robust support for handling HTTP headers in your requests. You can configure and manipulate headers at both global and per-request levels. Here’s a detailed overview of how to work with headers using `fetchff`.

**Note:** Header keys are case-sensitive when specified in request objects. Ensure that the keys are provided in the correct case to avoid issues with header handling.

### How to Set Per-Request Headers

To set headers for a specific request, include the `headers` option in the request configuration. This option accepts an `object` where the keys are the header names and the values are the corresponding header values.

### Default Headers

The `fetchff` plugin automatically injects a set of default headers into every request. These default headers help ensure that requests are consistent and include necessary information for the server to process them correctly.

#### Default Headers Injected

- **`Content-Type`**: `application/json;charset=utf-8`
  Specifies that the request body contains JSON data and sets the character encoding to UTF-8.

- **`Accept`**: `application/json, text/plain, */*`
  Indicates the media types that the client is willing to receive from the server. This includes JSON, plain text, and any other types.

- **`Accept-Encoding`**: `gzip, deflate, br`
  Specifies the content encoding that the client can understand, including gzip, deflate, and Brotli compression.

### Setting Headers Globally

You can set default headers that will be included in all requests made with a specific `createApiFetcher` instance. This is useful for setting common headers like authentication tokens or content types.

#### Example: Setting Headers Globally

```typescript
import { createApiFetcher } from 'fetchff';

const api = createApiFetcher({
  baseURL: 'https://api.example.com/',
  headers: {
    'Content-Type': 'application/json',
    Authorization: 'Bearer YOUR_TOKEN',
  },
  // other configurations
});
```

### Setting Per-Request Headers

In addition to global default headers, you can also specify headers on a per-request basis. This allows you to override global headers or set specific headers for individual requests.

#### Example: Setting Per-Request Headers

```typescript
import { fetchf } from 'fetchff';

// Example of making a GET request with custom headers
const { data } = await fetchf('https://api.example.com/endpoint', {
  headers: {
    Authorization: 'Bearer YOUR_ACCESS_TOKEN',
    'Custom-Header': 'CustomValue',
  },
});
```

</details>

## 🌀 Interceptors

<details>
  <summary><span style="cursor:pointer">Click to expand</span></summary>
  <br>
  Interceptor functions can be provided to customize the behavior of requests and responses. These functions are invoked at different stages of the request lifecycle and allow for flexible handling of requests, responses, and errors.

### Example

```typescript
const { data } = await fetchf('https://api.example.com/', {
  onRequest(config) {
    // Add a custom header before sending the request
    config.headers['Authorization'] = 'Bearer your-token';
  },
  onResponse(response) {
    // Log the response status
    console.log(`Response Status: ${response.status}`);
  },
  onError(error, config) {
    // Handle errors and log the request config
    console.error('Request failed:', error);
    console.error('Request config:', config);
  },
});
```

### Configuration

The following options are available for configuring interceptors in the `RequestHandler`:

- **`onRequest`**:  
  Type: `RequestInterceptor | RequestInterceptor[]`  
  A function or an array of functions that are invoked before sending a request. Each function receives the request configuration object as its argument, allowing you to modify request parameters, headers, or other settings.  
  _Default:_ `(config) => config` (no modification).

- **`onResponse`**:  
  Type: `ResponseInterceptor | ResponseInterceptor[]`  
  A function or an array of functions that are invoked when a response is received. Each function receives the full response object, enabling you to process the response, handle status codes, or parse data as needed.  
  _Default:_ `(response) => response` (no modification).

- **`onError`**:  
  Type: `ErrorInterceptor | ErrorInterceptor[]`  
  A function or an array of functions that handle errors when a request fails. Each function receives the error and request configuration as arguments, allowing you to implement custom error handling logic or logging.  
  _Default:_ `(error) => error` (no modification).

### How It Works

1. **Request Interception**:  
   Before a request is sent, the `onRequest` interceptors are invoked. These interceptors can modify the request configuration, such as adding headers or changing request parameters.

2. **Response Interception**:  
   Once a response is received, the `onResponse` interceptors are called. These interceptors allow you to handle the response data, process status codes, or transform the response before it is returned to the caller.

3. **Error Interception**:  
   If a request fails and an error occurs, the `onError` interceptors are triggered. These interceptors provide a way to handle errors, such as logging or retrying requests, based on the error and the request configuration.

4. **Custom Handling**:  
   Each interceptor function provides a flexible way to customize request and response behavior. You can use these functions to integrate with other systems, handle specific cases, or modify requests and responses as needed.

</details>

## 🔍 Error Handling

<details>
  <summary><span style="cursor:pointer">Click to expand</span></summary>
  <br>
  Error handling strategies define how to manage errors that occur during requests. You can configure the <b>strategy</b> option to specify what should happen when an error occurs. This affects whether promises are rejected, if errors are handled silently, or if default responses are provided. You can also combine it with <b>onError</b> interceptor for more tailored approach.

### Example

Here's an example of how to configure error handling:

```typescript
const { data } = await fetchf('https://api.example.com/', {
  strategy: 'reject', // Use 'reject' strategy for error handling (default)
});
```

### Configuration

The `strategy` option can be configured with the following values:
_Default:_ `reject`.

- **`reject`**:  
  Promises are rejected, and global error handling is triggered. You must use `try/catch` blocks to handle errors.

- **`softFail`**:  
  Returns a response object with additional properties such as `data`, `error`, `config`, `request`, and `headers` when an error occurs. This approach avoids throwing errors, allowing you to handle error information directly within the response object without the need for `try/catch` blocks.

- **`defaultResponse`**:  
  Returns a default response specified in case of an error. The promise will not be rejected. This can be used in conjunction with `flattenResponse` and `defaultResponse: {}` to provide sensible defaults.

- **`silent`**:  
  Hangs the promise silently on error, useful for fire-and-forget requests without the need for `try/catch`. In case of an error, the promise will never be resolved or rejected, and any code after will never be executed. This strategy is useful for dispatching requests within asynchronous wrapper functions that do not need to be awaited. It prevents excessive usage of `try/catch` or additional response data checks everywhere. It can be used in combination with `onError` to handle errors separately.

### How It Works

1. **Reject Strategy**:  
   When using the `reject` strategy, if an error occurs, the promise is rejected, and global error handling logic is triggered. You must use `try/catch` to handle these errors.

2. **Soft Fail Strategy**:  
   With `softFail`, the response object includes additional properties that provide details about the error without rejecting the promise. This allows you to handle error information directly within the response.

3. **Default Response Strategy**:  
   The `defaultResponse` strategy returns a predefined default response when an error occurs. This approach prevents the promise from being rejected, allowing for default values to be used in place of error data.

4. **Silent Strategy**:  
   The `silent` strategy results in the promise hanging silently on error. The promise will not be resolved or rejected, and any subsequent code will not execute. This is useful for fire-and-forget requests and can be combined with `onError` for separate error handling.

5. **Custom Error Handling**:  
   Depending on the strategy chosen, you can tailor how errors are managed, either by handling them directly within response objects, using default responses, or managing them silently.

</details>

## 🗄️ Smart Cache Management

<details>
  <summary><span style="cursor:pointer">Click to expand</span></summary>
  <br>
  The caching mechanism in <b>fetchf()</b> and <b>createApiFetcher()</b> enhances performance by reducing redundant network requests and reusing previously fetched data when appropriate. This system ensures that cached responses are managed efficiently and only used when considered "fresh". Below is a breakdown of the key parameters that control caching behavior and their default values.

### Example

```typescript
const { data } = await fetchf('https://api.example.com/', {
  cacheTime: 300, // Cache is valid for 5 minutes
  cacheKey: (config) => `${config.url}-${config.method}`, // Custom cache key based on URL and method
  cacheBuster: (config) => config.method === 'POST', // Bust cache for POST requests
  skipCache: (response, config) => response.status !== 200, // Skip caching on non-200 responses
});
```

### Configuration

The caching system can be fine-tuned using the following options when configuring the:

- **`cacheTime`**:  
  Type: `number`  
  Specifies the duration, in seconds, for which a cache entry is considered "fresh." Once this time has passed, the entry is considered stale and may be refreshed with a new request.  
  _Default:_ `0` (no caching).

- **`cacheKey`**:  
  Type: `CacheKeyFunction`  
  A function used to generate a custom cache key for the request. If not provided, a default key is created by hashing various parts of the request, including `Method`, `URL`, query parameters, and headers.  
  _Default:_ Auto-generated based on request properties.

- **`cacheBuster`**:  
  Type: `CacheBusterFunction`  
  A function that allows you to invalidate or refresh the cache under certain conditions, such as specific request methods or response properties. This is useful for ensuring that certain requests (e.g., `POST`) bypass the cache.  
  _Default:_ `(config) => false` (no cache busting).

- **`skipCache`**:  
  Type: `CacheSkipFunction`  
  A function that determines whether caching should be skipped based on the response. This allows for fine-grained control over whether certain responses are cached or not, such as skipping non-`200` responses.  
  _Default:_ `(response, config) => false` (no skipping).

### How It Works

1. **Request and Cache Check**:  
   When a request is made, the cache is first checked for an existing entry. If a valid cache entry is found and is still "fresh" (based on `cacheTime`), the cached response is returned immediately. Note that when the native `fetch()` setting called `cache` is set to `reload` the request will automatically skip the internal cache.

2. **Cache Key**:  
   A cache key uniquely identifies each request. By default, the key is generated based on the URL and other relevant request options. Custom keys can be provided using the `cacheKey` function.

3. **Cache Busting**:  
   If the `cacheBuster` function is defined, it determines whether to invalidate and refresh the cache for specific requests. This is useful for ensuring that certain requests, such as `POST` requests, always fetch new data.

4. **Skipping Cache**:  
   The `skipCache` function provides flexibility in deciding whether to store a response in the cache. For example, you might skip caching responses that have a `4xx` or `5xx` status code.

5. **Final Outcome**:  
   If no valid cache entry is found, or the cache is skipped or busted, the request proceeds to the network, and the response is cached based on the provided configuration.

</details>

## ✋ Automatic Request Cancellation

<details>
  <summary><span style="cursor:pointer">Click to expand</span></summary>
  <br>
<b>fetchff</b> simplifies making API requests by allowing customizable features such as request cancellation, retries, and response flattening. When a new request is made to the same API endpoint, the plugin automatically cancels any previous requests that haven't completed, ensuring that only the most recent request is processed.
<br><br>
It also supports:

- Automatic retries for failed requests with configurable delay and exponential backoff.
- Optional flattening of response data for easier access, removing nested `data` fields.

You can choose to reject cancelled requests or return a default response instead through the `defaultResponse` setting.

### Example

```javascript
import { fetchf } from 'fetchff';

// Fire requests to sendPost every 100 ms. In this example you can see that previous requests are automatically cancelled
setInterval(async () => {
  // Create an API fetcher with cancellable requests enabled (note that we don't await here)
  await fetchf('https://example.com/api/post/send', {
    method: 'POST',
    cancellable: true,
    rejectCancelled: true,
    dedupeTime: 0, // Disable request deduplication so to mimic cancellation of previous requests
  });
}, 100);
```

### Configuration

- **`cancellable`**:
  Type: `boolean`
  Default: `false`
  If set to `true`, any ongoing previous requests to the same API endpoint will be automatically cancelled when a subsequent request is made before the first one completes. This is useful in scenarios where repeated requests are made to the same endpoint (e.g., search inputs) and only the latest response is needed, avoiding unnecessary requests to the backend.

- **`rejectCancelled`**:
  Type: `boolean`
  Default: `false`
  Works in conjunction with the `cancellable` option. If set to `true`, the promise of a cancelled request will be rejected. By default (`false`), when a request is cancelled, instead of rejecting the promise, a `defaultResponse` will be returned, allowing graceful handling of cancellation without errors.

</details>

## 📶 Polling Configuration

<details>
  <summary><span style="cursor:pointer">Click to expand</span></summary>
  <br>
  Polling can be configured to repeatedly make requests at defined intervals until certain conditions are met. This allows for continuously checking the status of a resource or performing background updates.

### Example

Here's an example of how to configure polling:

```typescript
const { data } = await fetchf('https://api.example.com/', {
  pollingInterval: 5000, // Poll every 5 seconds
  shouldStopPolling: (response, error, attempt) => {
    if (response && response.status === 200) {
      return true; // Stop polling if the response status is 200 (OK)
    }
    if (attempt >= 10) {
      return true; // Stop polling after 10 attempts
    }
    return false; // Continue polling otherwise
  },
});
```

### Configuration

The following options are available for configuring polling in the `RequestHandler`:

- **`pollingInterval`**:  
  Type: `number`  
  Interval in milliseconds between polling attempts. If set to `0`, polling is disabled. This allows you to control the frequency of requests when polling is enabled.  
  _Default:_ `0` (polling disabled).

- **`shouldStopPolling`**:  
  Type: `(response: any, error: any, attempt: number) => boolean`  
  A function to determine if polling should stop based on the response, error, or the current polling attempt number. Return `true` to stop polling, and `false` to continue polling. This allows for custom logic to decide when to stop polling based on the conditions of the response or error.  
  _Default:_ `(response, error, attempt) => false` (polling continues indefinitely unless manually stopped).

### How It Works

1. **Polling Interval**:  
   When `pollingInterval` is set to a non-zero value, polling begins after the initial request. The request is repeated at intervals defined by the `pollingInterval` setting.

2. **Stopping Polling**:  
   The `shouldStopPolling` function is invoked after each polling attempt. If it returns `true`, polling will stop. Otherwise, polling will continue until the condition to stop is met, or polling is manually stopped.

3. **Custom Logic**:  
   The `shouldStopPolling` function provides flexibility to implement custom logic based on the response, error, or the number of attempts. This makes it easy to stop polling when the desired outcome is reached or after a maximum number of attempts.

</details>

## 🔄 Retry Mechanism

<details>
  <summary><span style="cursor:pointer">Click to expand</span></summary>
  <br>
The retry mechanism can be used to handle transient errors and improve the reliability of network requests. This mechanism automatically retries requests when certain conditions are met, providing robustness in the face of temporary failures. Below is an overview of how the retry mechanism works and how it can be configured.

### Example

```typescript
const { data } = await fetchf('https://api.example.com/', {
  retry: {
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
  },
});
```

### Configuration

The retry mechanism is configured via the `retry` option when instantiating the `RequestHandler`. You can customize the following parameters:

- **`retries`**:  
  Type: `number`  
  Number of retry attempts to make after an initial failure.  
  _Default:_ `0` (no retries).

- **`delay`**:  
  Type: `number`  
  Initial delay (in milliseconds) before the first retry attempt. Subsequent retries use an exponentially increasing delay based on the `backoff` parameter.  
  _Default:_ `1000` (1 second).

- **`maxDelay`**:  
  Type: `number`  
  Maximum delay (in milliseconds) between retry attempts. The delay will not exceed this value, even if the exponential backoff would suggest a longer delay.  
  _Default:_ `30000` (30 seconds).

- **`backoff`**:  
  Type: `number`  
  Factor by which the delay is multiplied after each retry. For example, a `backoff` factor of `1.5` means each retry delay is 1.5 times the previous delay.  
  _Default:_ `1.5`.

- **`retryOn`**:  
  Type: `number[]`  
  Array of HTTP status codes that should trigger a retry. By default, retries are triggered for the following status codes:

  - `408` - Request Timeout
  - `409` - Conflict
  - `425` - Too Early
  - `429` - Too Many Requests
  - `500` - Internal Server Error
  - `502` - Bad Gateway
  - `503` - Service Unavailable
  - `504` - Gateway Timeout

- **`shouldRetry`**:  
  Type: `RetryFunction`  
  Function that determines whether a retry should be attempted based on the error and the current attempt number. This function receives the error object and the attempt number as arguments.  
  _Default:_ Retry up to the number of specified attempts.

### How It Works

1. **Initial Request**: When a request fails, the retry mechanism captures the failure and checks if it should retry based on the `retryOn` configuration and the result of the `shouldRetry` function.

2. **Retry Attempts**: If a retry is warranted:

   - The request is retried up to the specified number of attempts (`retries`).
   - Each retry waits for a delay before making the next attempt. The delay starts at the initial `delay` value and increases exponentially based on the `backoff` factor, but will not exceed the `maxDelay`.

3. **Logging**: During retries, the mechanism logs warnings indicating the retry attempts and the delay before the next attempt, which helps in debugging and understanding the retry behavior.

4. **Final Outcome**: If all retry attempts fail, the request will throw an error, and the final failure is processed according to the configured error handling logic.

</details>

## 🧩 Response Data Transformation

<details>
  <summary><span style="cursor:pointer">Click to expand</span></summary>
  <br>

The `fetchff` plugin automatically handles response data transformation for any instance of `Response` returned by the `fetch()` (or a custom `fetcher`) based on the `Content-Type` header, ensuring that data is parsed correctly according to its format.

### **How It Works**

- **JSON (`application/json`):** Parses the response as JSON.
- **Form Data (`multipart/form-data`):** Parses the response as `FormData`.
- **Binary Data (`application/octet-stream`):** Parses the response as a `Blob`.
- **URL-encoded Form Data (`application/x-www-form-urlencoded`):** Parses the response as `FormData`.
- **Text (`text/*`):** Parses the response as plain text.

If the `Content-Type` header is missing or not recognized, the plugin defaults to attempting JSON parsing. If that fails, it will try to parse the response as text.

This approach ensures that the `fetchff` plugin can handle a variety of response formats, providing a flexible and reliable method for processing data from API requests.

### `onResponse` Interceptor

You can use the `onResponse` interceptor to customize how the response is handled before it reaches your application. This interceptor gives you access to the raw `Response` object, allowing you to transform the data or modify the response behavior based on your needs.

</details>

## 📄 Response Object

<details>
  <summary><span style="cursor:pointer">Click to expand</span></summary>
  <br>
Each request returns the following Response Object of type <b>FetchResponse&lt;ResponseData&gt;</b> where ResponseData is usually your custom interface or `object`.

### Structure of the Response Object

- **`data`**:

  - **Type**: `ResponseData` (or your custom type passed through generic)

  - Contains the actual data returned from the API request.

- **`error`**:

  - **Type**: `ResponseErr`

  - An object with details about any error that occurred or `null` otherwise.
  - **`name`**: The name of the error (e.g., 'ResponseError').
  - **`message`**: A descriptive message about the error.
  - **`status`**: The HTTP status code of the response (e.g., 404, 500).
  - **`statusText`**: The HTTP status text of the response (e.g., 'Not Found', 'Internal Server Error').
  - **`request`**: Details about the HTTP request that was sent (e.g., URL, method, headers).
  - **`config`**: The configuration object used for the request, including URL, method, headers, and query parameters.
  - **`response`**: The full response object received from the server, including all headers and body.

- **`config`**:

  - **Type**: `RequestConfig`
  - The configuration object with all settings used for the request, including URL, method, headers, and query parameters.

- **`request`**:

  - **Type**: `RequestConfig`
  - An alias for `config`.

- **`headers`**:

  - **Type**: `HeadersObject`
  - The response headers returned by the server, such as content type and caching information returned as simple key-value object.

</details>

## 📦 Typings

<details>
  <summary><span style="cursor:pointer">Click to expand</span></summary>
  <br>

The `fetchff` package provides comprehensive TypeScript typings to enhance development experience and ensure type safety. Below are details on the available types for both `createApiFetcher()` and `fetchf()`.

### Generic Typings

The `fetchff` package includes several generic types to handle various aspects of API requests and responses:

- **`QueryParams<T = unknown>`**: Represents query parameters for requests. Can be an object, `URLSearchParams`, an array of name-value pairs, or `null`.
- **`BodyPayload<T = any>`**: Represents the request body. Can be `BodyInit`, an object, an array, a string, or `null`.
- **`QueryParamsOrBody<T = unknown>`**: Union type for query parameters or body payload. Can be either `QueryParams<T>` or `BodyPayload<T>`.
- **`UrlPathParams<T = unknown>`**: Represents URL path parameters. Can be an object or `null`.

### Typings for `createApiFetcher()`

The `createApiFetcher()` function provides a robust set of types to define and manage API interactions. The key types available are:

- **`Endpoint<ResponseData = APIResponse, QueryParams = QueryParamsOrBody, PathParams = UrlPathParams>`**: Represents an API endpoint function, allowing to be defined with optional query parameters, URL path parameters, and request configuration.
- **`EndpointsMethods`**: Represents the list of API endpoints with their respective settings. It is your own interface that you can pass. It will be cross-checked against the `endpoints` property of the `createApiFetcher()` configuration. Each endpoint can be configured with its own specific settings such as query parameters, URL path parameters, and request configurations.
- **`EndpointsCfg`**: Configuration for API endpoints, including query parameters, URL path parameters, and additional request configurations.
- **`RequestInterceptor`**: Function to modify request configurations before they are sent.
- **`ResponseInterceptor`**: Function to process responses before they are handled by the application.
- **`ErrorInterceptor`**: Function to handle errors when a request fails.
- **`CreatedCustomFetcherInstance`**: Represents the custom `fetcher` instance created by its `create()` function.

For a full list of types and detailed definitions, refer to the [api-handler.ts](https://github.com/MattCCC/fetchff/blob/docs-update/src/types/api-handler.ts) file.

### Typings for `fetchf()`

The `fetchf()` function includes types that help configure and manage network requests effectively:

- **`RequestHandlerConfig`**: Main configuration options for the `fetchf()` function, including request settings, interceptors, and retry configurations.
- **`RetryConfig`**: Configuration options for retry mechanisms, including the number of retries, delay between retries, and backoff strategies.
- **`CacheConfig`**: Configuration options for caching, including cache time, custom cache keys, and cache invalidation rules.
- **`PollingConfig`**: Configuration options for polling, including polling intervals and conditions to stop polling.
- **`ErrorStrategy`**: Defines strategies for handling errors, such as rejection, soft fail, default response, and silent modes.

For a complete list of types and their definitions, refer to the [request-handler.ts](https://github.com/MattCCC/fetchff/blob/docs-update/src/types/request-handler.ts) file.

### Benefits of Using Typings

- **Type Safety**: Ensures that configurations and requests adhere to expected formats, reducing runtime errors and improving reliability.
- **Autocompletion**: Provides better support for autocompletion in editors, making development faster and more intuitive.
- **Documentation**: Helps in understanding available options and their expected values, improving code clarity and maintainability.

</details>

## Comparison with another libraries

| Feature                                            | fetchff     | ofetch       | wretch       | axios        | native fetch() |
| -------------------------------------------------- | ----------- | ------------ | ------------ | ------------ | -------------- |
| **Unified API Client**                             | ✅          | --           | --           | --           | --             |
| **Smart Request Cache**                            | ✅          | --           | --           | --           | --             |
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
| **Minimal Installation Size**                      | 🟢 (3.3 KB) | 🟡 (6.41 KB) | 🟢 (2.21 KB) | 🔴 (13.7 KB) | 🟢 (0 KB)      |

## ✏️ Examples

Click to expand particular examples below. You can also check [examples.ts](./docs/examples/examples.ts) for more examples of usage.

### All Settings

<details>
  <summary><span style="cursor:pointer">Click to expand</span></summary>
  <br>

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
  pollingInterval: 5000, // Interval in milliseconds between polling attempts. Setting 0 disables polling.
  shouldStopPolling: (response, error, attempt) => false, // Function to determine if polling should stop based on the response. Returns true to stop polling, false to continue.
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
  },
  async onResponse(response) {
    // Interceptor on each response
    console.error('Fired on each response', response);
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

</details>

### Examples Using <i>createApiFetcher()</i>

All examples below are with usage of `createApiFetcher()`. You can also use `fetchf()` independently.

#### Multiple APIs Handler from different API sources

<details>
  <summary><span style="cursor:pointer">Click to expand</span></summary>
  <br>

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

</details>

#### Using with Full TypeScript Support

<details>
  <summary><span style="cursor:pointer">Click to expand</span></summary>
  <br>

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

</details>

#### Using with TypeScript and Custom Headers

<details>
  <summary><span style="cursor:pointer">Click to expand</span></summary>
  <br>

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

</details>

#### Custom Fetcher

<details>
  <summary><span style="cursor:pointer">Click to expand</span></summary>
  <br>

```typescript
import { createApiFetcher, RequestConfig, FetchResponse } from 'fetchff';

// Define the custom fetcher object
const customFetcher = {
  create() {
    // Create instance here. It will be called at the beginning of every request.
    return {
      // This function will be called whenever a request is being fired.
      request: async (config: RequestConfig): Promise<FetchResponse> => {
        // Implement your custom fetch logic here
        const response = await fetch(config.url, config);
        // Optionally, process or transform the response
        return response;
      },
    };
  },
};

// Create the API fetcher with the custom fetcher
const api = createApiFetcher({
  baseURL: 'https://api.example.com/',
  retry: retryConfig,
  fetcher: customFetcher, // Provide the custom fetcher object directly
  endpoints: {
    getBooks: {
      url: 'books/all',
      method: 'get',
      cancellable: true,
      // All the global settings can be specified on per-endpoint basis as well
    },
  },
});
```

</details>

#### Error handling strategy - `reject` (default)

<details>
  <summary><span style="cursor:pointer">Click to expand</span></summary>
  <br>

```typescript
import { createApiFetcher } from 'fetchff';

const api = createApiFetcher({
  apiUrl: 'https://example.com/api',
  endpoints: {
    sendMessage: {
      method: 'post',
      url: '/send-message/:postId',
      strategy: 'reject', // It is a default strategy so it does not really need to be here
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

</details>

#### Error handling strategy - `softFail`

<details>
  <summary><span style="cursor:pointer">Click to expand</span></summary>
  <br>

```typescript
import { createApiFetcher } from 'fetchff';

const api = createApiFetcher({
  apiUrl: 'https://example.com/api',
  endpoints: {
    sendMessage: {
      method: 'post',
      url: '/send-message/:postId',
      strategy: 'softFail', // Returns a response object with additional error details without rejecting the promise.
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

</details>

#### Error handling strategy - `defaultResponse`

<details>
  <summary><span style="cursor:pointer">Click to expand</span></summary>
  <br>

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

</details>

#### Error handling strategy - `silent`

<details>
  <summary><span style="cursor:pointer">Click to expand</span></summary>
  <br>

```typescript
import { createApiFetcher } from 'fetchff';

const api = createApiFetcher({
  apiUrl: 'https://example.com/api',
  endpoints: {
    sendMessage: {
      method: 'post',
      url: '/send-message/:postId',

      // You can also specify strategy and other settings in here, just for this endpoint
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

</details>

#### `onError` Interceptor

<details>
  <summary><span style="cursor:pointer">Click to expand</span></summary>
  <br>

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
        console.log(error.response);
        console.log(error.config);
      },
    },
  );

  console.log('Message sent successfully');
}

sendMessage();
```

</details>

#### Request Chaining

<details>
  <summary><span style="cursor:pointer">Click to expand</span></summary>
  <br>

In this example, we make an initial request to get a user's details, then use that data to fetch additional information in a subsequent request. This pattern allows you to perform multiple asynchronous operations in sequence, using the result of one request to drive the next.

```typescript
import { createApiFetcher } from 'fetchff';

// Initialize API fetcher with endpoints
const api = createApiFetcher({
  endpoints: {
    getUser: { url: '/user' },
    createPost: { url: '/post' },
  },
  apiUrl: 'https://example.com/api',
});

async function fetchUserAndCreatePost(userId: number, postData: any) {
  // Fetch user data
  const { data: userData } = await api.getUser({ userId });

  // Create a new post with the fetched user data
  return await api.createPost({
    ...postData,
    userId: userData.id, // Use the user's ID from the response
  });
}

// Example usage
fetchUserAndCreatePost(1, { title: 'New Post', content: 'This is a new post.' })
  .then((response) => console.log('Post created:', response))
  .catch((error) => console.error('Error:', error));
```

</details>

### Example Usage with Frameworks and Libraries

`fetchff` is designed to seamlessly integrate with any popular frameworks like Next.js, libraries like React, Vue, React Query and SWR. It is written in pure JS so you can effortlessly manage API requests with minimal setup, and without any dependencies.

#### Using with React

<details>
  <summary><span style="cursor:pointer">Click to expand</span></summary>
  <br>
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

</details>

#### Using with React Query

<details>
  <summary><span style="cursor:pointer">Click to expand</span></summary>
  <br>

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

</details>

#### Using with SWR

<details>
  <summary><span style="cursor:pointer">Click to expand</span></summary>
  <br>

Combine `fetchff` with SWR for efficient data fetching and caching.

Single calls:

```typescript
const fetchProfile = ({ id }) =>
  fetchf('https://example.com/api/profile/:id', { urlPathParams: id });

export const useProfile = ({ id }) => {
  const { data, error } = useSWR(['profile', id], fetchProfile);

  return {
    profile: data,
    isLoading: !error && !data,
    isError: error,
  };
};
```

Many endpoints:

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

</details>

#### 🌊 Using with Vue

<details>
  <summary><span style="cursor:pointer">Click to expand</span></summary>
  <br>

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

</details>

## 🛠️ Compatibility and Polyfills

<details>
  <summary><span style="cursor:pointer">Click to expand</span></summary>

### Compatibility

While `fetchff` is designed to work seamlessly with modern environments (ES2018+), some older browsers or specific edge cases might require additional support.

Currently, `fetchff` offers three types of builds:

1. <b>Browser ESM build (.mjs):</b> Ideal for modern browsers and module-based environments (when you use the [type="module"](https://caniuse.com/?search=type%3D%22module%22) attribute).
   Location: `dist/browser/index.mjs`
   Compatibility: `ES2018+`

2. <b>Standard Browser build:</b> A global UMD bundle, compatible with older browsers.
   Location: `dist/browser/index.global.js`
   Compatibility: `ES2018+`

3. <b>Node.js CJS build:</b> Designed for Node.js environments that rely on CommonJS modules.
   Location: `dist/node/index.js`
   Compatibility: `Node.js 18+`

For projects that need to support older browsers, especially those predating ES2018, additional polyfills or transpilation may be necessary. Consider using tools like Babel, SWC or core-js to ensure compatibility with environments that do not natively support ES2018+ features. Bundlers like Webpack or Rollup usually handle these concerns out of the box.

You can check [Can I Use ES2018](https://github.com/github/fetch) to verify browser support for specific ES2018 features.

### Polyfills

For environments that do not support modern JavaScript features or APIs, you might need to include polyfills. Some common polyfills include:

- **Fetch Polyfill**: For environments that do not support the native `fetch` API. You can use libraries like [whatwg-fetch](https://github.com/github/fetch) to provide a fetch implementation.
- **Promise Polyfill**: For older browsers that do not support Promises. Libraries like [es6-promise](https://github.com/stefanpenner/es6-promise) can be used.
- **AbortController Polyfill**: For environments that do not support the `AbortController` API used for aborting fetch requests. You can use the [abort-controller](https://github.com/mysticatea/abort-controller) polyfill.

</details>

## ✔️ Support and collaboration

If you have any idea for an improvement, please file an issue. Feel free to make a PR if you are willing to collaborate on the project. Thank you :)

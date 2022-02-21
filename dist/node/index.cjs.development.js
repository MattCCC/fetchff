'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var tslib = require('tslib');
var jsMagic = require('js-magic');
var axios = _interopDefault(require('axios'));

function _extends() {
  _extends = Object.assign || function (target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i];

      for (var key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          target[key] = source[key];
        }
      }
    }

    return target;
  };

  return _extends.apply(this, arguments);
}

function _objectWithoutPropertiesLoose(source, excluded) {
  if (source == null) return {};
  var target = {};
  var sourceKeys = Object.keys(source);
  var key, i;

  for (i = 0; i < sourceKeys.length; i++) {
    key = sourceKeys[i];
    if (excluded.indexOf(key) >= 0) continue;
    target[key] = source[key];
  }

  return target;
}

// A type of promise-like that resolves synchronously and supports only one observer

const _iteratorSymbol = /*#__PURE__*/ typeof Symbol !== "undefined" ? (Symbol.iterator || (Symbol.iterator = Symbol("Symbol.iterator"))) : "@@iterator";

const _asyncIteratorSymbol = /*#__PURE__*/ typeof Symbol !== "undefined" ? (Symbol.asyncIterator || (Symbol.asyncIterator = Symbol("Symbol.asyncIterator"))) : "@@asyncIterator";

// Asynchronously call a function and send errors to recovery continuation
function _catch(body, recover) {
	try {
		var result = body();
	} catch(e) {
		return recover(e);
	}
	if (result && result.then) {
		return result.then(void 0, recover);
	}
	return result;
}

class HttpRequestErrorHandler {
  constructor(logger, httpRequestErrorService) {
    this.logger = logger;
    this.httpRequestErrorService = httpRequestErrorService;
  }
  /**
   * Process and Error
   *
   * @param {*} error Error instance or message
   * @throws          Request error context
   * @returns {void}
   */


  process(error) {
    if (this.logger && this.logger.warn) {
      this.logger.warn('API ERROR', error);
    }

    let errorContext = error;

    if (typeof error === 'string') {
      errorContext = new Error(error);
    }

    if (this.httpRequestErrorService) {
      if (typeof this.httpRequestErrorService.process !== 'undefined') {
        this.httpRequestErrorService.process(errorContext);
      } else if (typeof this.httpRequestErrorService === 'function') {
        this.httpRequestErrorService(errorContext);
      }
    }
  }

}

/**
 * Generic Request Handler
 * It creates an Axios instance and handles requests within that instance
 * It handles errors depending on a chosen error handling strategy
 */

exports.HttpRequestHandler = class HttpRequestHandler {
  /**
   * Creates an instance of HttpRequestHandler
   *
   * @param {string} baseURL              Base URL for all API calls
   * @param {number} timeout              Request timeout
   * @param {string} strategy             Error Handling Strategy
   * @param {string} flattenResponse      Whether to flatten response "data" object within "data" one
   * @param {*} logger                    Instance of Logger Class
   * @param {*} httpRequestErrorService   Instance of Error Service Class
   */
  constructor(_ref) {
    let {
      baseURL = '',
      timeout = null,
      cancellable = false,
      strategy = null,
      flattenResponse = null,
      defaultResponse = {},
      logger = null,
      onError = null
    } = _ref,
        config = _objectWithoutPropertiesLoose(_ref, ["baseURL", "timeout", "cancellable", "strategy", "flattenResponse", "defaultResponse", "logger", "onError"]);

    /**
     * @var timeout Request timeout
     */
    this.timeout = 30000;
    /**
     * @var cancellable Response cancellation
     */

    this.cancellable = false;
    /**
     * @var strategy Request timeout
     */

    this.strategy = 'silent';
    /**
     * @var flattenResponse Response flattening
     */

    this.flattenResponse = true;
    /**
     * @var defaultResponse Response flattening
     */

    this.defaultResponse = null;
    this.timeout = timeout !== null ? timeout : this.timeout;
    this.strategy = strategy !== null ? strategy : this.strategy;
    this.cancellable = cancellable || this.cancellable;
    this.flattenResponse = flattenResponse !== null ? flattenResponse : this.flattenResponse;
    this.defaultResponse = defaultResponse;
    this.logger = logger || global.console || window.console || null;
    this.httpRequestErrorService = onError;
    this.requestsQueue = new Map();
    this.requestInstance = axios.create(_extends({}, config, {
      baseURL,
      timeout: this.timeout
    }));
  }
  /**
   * Get Provider Instance
   *
   * @returns {AxiosInstance} Provider's instance
   */


  getInstance() {
    return this.requestInstance;
  }
  /**
   * Intercept Request
   *
   * @param {*} callback callback to use before request
   * @returns {void}
   */


  interceptRequest(callback) {
    this.getInstance().interceptors.request.use(callback);
  }
  /**
   * Maps all API requests
   *
   * @param {string} url                  Url
   * @param {*} data                      Payload
   * @param {EndpointConfig} config       Config
   * @throws {RequestError}                      If request fails
   * @returns {Promise}                   Request response or error info
   */


  __get(prop) {
    if (prop in this) {
      return this[prop];
    }

    return this.prepareRequest.bind(this, prop);
  }
  /**
   * Prepare Request
   *
   * @param {string} url                  Url
   * @param {*} data                      Payload
   * @param {EndpointConfig} config       Config
   * @throws {RequestError}                      If request fails
   * @returns {Promise}                   Request response or error info
   */


  prepareRequest(type, url, data = null, config = null) {
    return this.handleRequest({
      type,
      url,
      data,
      config
    });
  }
  /**
   * Build request configuration
   *
   * @param {string} method               Request method
   * @param {string} url                  Request url
   * @param {*}      data                 Request data
   * @param {EndpointConfig} config       Request config
   * @returns {AxiosInstance} Provider's instance
   */


  buildRequestConfig(method, url, data, config) {
    const methodLowerCase = method.toLowerCase();
    const key = methodLowerCase === 'get' || methodLowerCase === 'head' ? 'params' : 'data';
    return _extends({}, config, {
      url,
      method: methodLowerCase,
      [key]: data || {}
    });
  }
  /**
   * Process global Request Error
   *
   * @param {RequestError} error      Error instance
   * @param {EndpointConfig} requestConfig   Per endpoint request config
   * @returns {AxiosInstance} Provider's instance
   */


  processRequestError(error, requestConfig) {
    if (axios.isCancel(error)) {
      return;
    } // Invoke per request "onError" call


    if (requestConfig.onError && typeof requestConfig.onError === 'function') {
      requestConfig.onError(error);
    }

    const errorHandler = new HttpRequestErrorHandler(this.logger, this.httpRequestErrorService);
    errorHandler.process(error);
  }
  /**
   * Output error response depending on chosen strategy
   *
   * @param {RequestError} error      Error instance
   * @param {EndpointConfig} requestConfig   Per endpoint request config
   * @returns {AxiosInstance} Provider's instance
   */


  outputErrorResponse(error, requestConfig) {
    try {
      let _exit = false;

      const _this = this;

      function _temp2(_result) {
        return _exit ? _result : errorHandlingStrategy === 'reject' || errorHandlingStrategy === 'throwError' ? Promise.reject(error) : _this.defaultResponse;
      }

      const isRequestCancelled = requestConfig.cancelToken && axios.isCancel(error);
      const errorHandlingStrategy = requestConfig.strategy || _this.strategy; // By default cancelled requests aren't rejected

      if (isRequestCancelled && !requestConfig.rejectCancelled) {
        return Promise.resolve(_this.defaultResponse);
      }

      const _temp = function () {
        if (errorHandlingStrategy === 'silent') {
          // Hang the promise
          return Promise.resolve(new Promise(() => null)).then(function () {
            const _this$defaultResponse = _this.defaultResponse;
            _exit = true;
            return _this$defaultResponse;
          });
        }
      }();

      return Promise.resolve(_temp && _temp.then ? _temp.then(_temp2) : _temp2(_temp)); // Simply rejects a request promise
    } catch (e) {
      return Promise.reject(e);
    }
  }
  /**
   * Output error response depending on chosen strategy
   *
   * @param {RequestError} error                     Error instance
   * @param {EndpointConfig} requestConfig    Per endpoint request config
   * @returns {*}                             Error response
   */


  isRequestCancelled(error, requestConfig) {
    return requestConfig.cancelToken && axios.isCancel(error);
  }
  /**
   * Automatically Cancel Previous Requests
   *
   * @param {string} type                    Request type
   * @param {string} url                     Request url
   * @param {EndpointConfig} requestConfig   Per endpoint request config
   * @returns {AxiosInstance} Provider's instance
   */


  addCancellationToken(type, url, requestConfig) {
    // Both disabled
    if (!this.cancellable && !requestConfig.cancellable) {
      return {};
    } // Explicitly disabled per request


    if (typeof requestConfig.cancellable !== "undefined" && !requestConfig.cancellable) {
      return {};
    }

    const key = `${type}-${url}`;
    const previousRequest = this.requestsQueue.get(key);

    if (previousRequest) {
      previousRequest.cancel();
    }

    const tokenSource = axios.CancelToken.source();
    this.requestsQueue.set(key, tokenSource);
    const mappedRequest = this.requestsQueue.get(key) || {};
    return mappedRequest.token ? {
      cancelToken: mappedRequest.token
    } : {};
  }
  /**
   * Handle Request depending on used strategy
   *
   * @param {object} payload                      Payload
   * @param {string} payload.type                 Request type
   * @param {string} payload.url                  Request url
   * @param {*} payload.data                      Request data
   * @param {EndpointConfig} payload.config       Request config
   * @throws {RequestError}
   * @returns {Promise} Response Data
   */


  handleRequest({
    type,
    url,
    data = null,
    config = null
  }) {
    try {
      let _exit2 = false;

      const _this2 = this;

      function _temp4(_result2) {
        return _exit2 ? _result2 : _this2.processResponseData(response);
      }

      let response = null;
      const endpointConfig = config || {};

      let requestConfig = _this2.buildRequestConfig(type, url, data, endpointConfig);

      requestConfig = _extends({}, _this2.addCancellationToken(type, url, requestConfig), requestConfig);

      const _temp3 = _catch(function () {
        return Promise.resolve(_this2.requestInstance.request(requestConfig)).then(function (_this2$requestInstanc) {
          response = _this2$requestInstanc;
        });
      }, function (error) {
        _this2.processRequestError(error, requestConfig);

        const _this2$outputErrorRes = _this2.outputErrorResponse(error, requestConfig);

        _exit2 = true;
        return _this2$outputErrorRes;
      });

      return Promise.resolve(_temp3 && _temp3.then ? _temp3.then(_temp4) : _temp4(_temp3));
    } catch (e) {
      return Promise.reject(e);
    }
  }
  /**
   * Process request response
   *
   * @param response Response object
   * @returns {*} Response data
   */


  processResponseData(response) {
    if (response.data) {
      if (!this.flattenResponse) {
        return response;
      } // Special case of data property within Axios data object
      // This is in fact a proper response but we may want to flatten it
      // To ease developers' lives when obtaining the response


      if (typeof response.data === 'object' && typeof response.data.data !== "undefined" && Object.keys(response.data).length === 1) {
        return response.data.data;
      }

      return response.data;
    }

    return this.defaultResponse;
  }

};
exports.HttpRequestHandler = /*#__PURE__*/tslib.__decorate([jsMagic.applyMagic], exports.HttpRequestHandler);

/**
 * Handles dispatching of API requests
 */

exports.ApiHandler = class ApiHandler {
  /**
   * Creates an instance of API Handler
   *
   * @param {string} apiUrl               Base URL for all API calls
   * @param {number} timeout              Request timeout
   * @param {string} strategy             Error Handling Strategy
   * @param {string} flattenResponse      Whether to flatten response "data" object within "data" one
   * @param {*} logger                    Instance of Logger Class
   * @param {*} onError                   Instance of Error Service Class
   */
  constructor(_ref) {
    let {
      apiUrl,
      apiEndpoints,
      timeout = null,
      cancellable = false,
      strategy = null,
      flattenResponse = null,
      defaultResponse = {},
      logger = null,
      onError = null
    } = _ref,
        config = _objectWithoutPropertiesLoose(_ref, ["apiUrl", "apiEndpoints", "timeout", "cancellable", "strategy", "flattenResponse", "defaultResponse", "logger", "onError"]);

    /**
     * Api Url
     */
    this.apiUrl = '';
    this.apiUrl = apiUrl;
    this.apiEndpoints = apiEndpoints;
    this.logger = logger;
    this.httpRequestHandler = new exports.HttpRequestHandler(_extends({}, config, {
      baseURL: this.apiUrl,
      timeout,
      cancellable,
      strategy,
      flattenResponse,
      defaultResponse,
      logger,
      onError
    }));
  }
  /**
   * Get Provider Instance
   *
   * @returns {AxiosInstance} Provider's instance
   */


  getInstance() {
    return this.httpRequestHandler.getInstance();
  }
  /**
   * Maps all API requests
   *
   * @param {*} prop          Caller
   * @returns {Function}      Tailored request function
   */


  __get(prop) {
    if (prop in this) {
      return this[prop];
    } // Prevent handler from running for non-existent endpoints


    if (!this.apiEndpoints[prop]) {
      return this.handleNonImplemented.bind(this, prop);
    }

    return this.handleRequest.bind(this, prop);
  }
  /**
   * Handle Single API Request
   *
   * @param {*} args      Arguments
   * @returns {Promise}   Resolvable API provider promise
   */


  handleRequest(...args) {
    try {
      const _this = this;

      const prop = args[0];
      const endpointSettings = _this.apiEndpoints[prop];
      const queryParams = args[1] || {};
      const uriParams = args[2] || {};
      const requestConfig = args[3] || {};
      const uri = endpointSettings.url.replace(/:[a-z]+/ig, str => uriParams[str.substr(1)] ? uriParams[str.substr(1)] : str);
      let responseData = null;

      const additionalRequestSettings = _extends({}, endpointSettings);

      delete additionalRequestSettings.url;
      delete additionalRequestSettings.method;
      return Promise.resolve(_this.httpRequestHandler[(endpointSettings.method || 'get').toLowerCase()](uri, queryParams, _extends({}, requestConfig, additionalRequestSettings))).then(function (_this$httpRequestHand) {
        responseData = _this$httpRequestHand;
        return responseData;
      });
    } catch (e) {
      return Promise.reject(e);
    }
  }
  /**
   * Triggered when trying to use non-existent endpoints
   *
   * @param prop Method Name
   * @returns {Promise}
   */


  handleNonImplemented(prop) {
    if (this.logger && this.logger.log) {
      this.logger.log(`${prop} endpoint not implemented.`);
    }

    return Promise.resolve(null);
  }

};
exports.ApiHandler = /*#__PURE__*/tslib.__decorate([jsMagic.applyMagic], exports.ApiHandler);
const createApiFetcher = options => new exports.ApiHandler(options);

exports.HttpRequestErrorHandler = HttpRequestErrorHandler;
exports.createApiFetcher = createApiFetcher;
//# sourceMappingURL=index.cjs.development.js.map

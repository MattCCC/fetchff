import { __decorate } from 'tslib';
import { applyMagic } from 'js-magic';
import axios from 'axios';

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

var HttpRequestErrorHandler = /*#__PURE__*/function () {
  function HttpRequestErrorHandler(logger, httpRequestErrorService) {
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


  var _proto = HttpRequestErrorHandler.prototype;

  _proto.process = function process(error) {
    if (this.logger && this.logger.warn) {
      this.logger.warn('API ERROR', error);
    }

    var errorContext = error;

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
  };

  return HttpRequestErrorHandler;
}();

/**
 * Generic Request Handler
 * It creates an Axios instance and handles requests within that instance
 * It handles errors depending on a chosen error handling strategy
 */

var HttpRequestHandler = /*#__PURE__*/function () {
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
  function HttpRequestHandler(_ref) {
    var _ref$baseURL = _ref.baseURL,
        baseURL = _ref$baseURL === void 0 ? '' : _ref$baseURL,
        _ref$timeout = _ref.timeout,
        timeout = _ref$timeout === void 0 ? null : _ref$timeout,
        _ref$cancellable = _ref.cancellable,
        cancellable = _ref$cancellable === void 0 ? false : _ref$cancellable,
        _ref$strategy = _ref.strategy,
        strategy = _ref$strategy === void 0 ? null : _ref$strategy,
        _ref$flattenResponse = _ref.flattenResponse,
        flattenResponse = _ref$flattenResponse === void 0 ? null : _ref$flattenResponse,
        _ref$defaultResponse = _ref.defaultResponse,
        defaultResponse = _ref$defaultResponse === void 0 ? {} : _ref$defaultResponse,
        _ref$logger = _ref.logger,
        logger = _ref$logger === void 0 ? null : _ref$logger,
        _ref$onError = _ref.onError,
        onError = _ref$onError === void 0 ? null : _ref$onError,
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
      baseURL: baseURL,
      timeout: this.timeout
    }));
  }
  /**
   * Get Provider Instance
   *
   * @returns {AxiosInstance} Provider's instance
   */


  var _proto = HttpRequestHandler.prototype;

  _proto.getInstance = function getInstance() {
    return this.requestInstance;
  }
  /**
   * Intercept Request
   *
   * @param {*} callback callback to use before request
   * @returns {void}
   */
  ;

  _proto.interceptRequest = function interceptRequest(callback) {
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
  ;

  _proto.__get = function __get(prop) {
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
  ;

  _proto.prepareRequest = function prepareRequest(type, url, data, config) {
    if (data === void 0) {
      data = null;
    }

    if (config === void 0) {
      config = null;
    }

    return this.handleRequest({
      type: type,
      url: url,
      data: data,
      config: config
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
  ;

  _proto.buildRequestConfig = function buildRequestConfig(method, url, data, config) {
    var _extends2;

    var methodLowerCase = method.toLowerCase();
    var key = methodLowerCase === 'get' || methodLowerCase === 'head' ? 'params' : 'data';
    return _extends({}, config, (_extends2 = {
      url: url,
      method: methodLowerCase
    }, _extends2[key] = data || {}, _extends2));
  }
  /**
   * Process global Request Error
   *
   * @param {RequestError} error      Error instance
   * @param {EndpointConfig} requestConfig   Per endpoint request config
   * @returns {AxiosInstance} Provider's instance
   */
  ;

  _proto.processRequestError = function processRequestError(error, requestConfig) {
    if (axios.isCancel(error)) {
      return;
    } // Invoke per request "onError" call


    if (requestConfig.onError && typeof requestConfig.onError === 'function') {
      requestConfig.onError(error);
    }

    var errorHandler = new HttpRequestErrorHandler(this.logger, this.httpRequestErrorService);
    errorHandler.process(error);
  }
  /**
   * Output error response depending on chosen strategy
   *
   * @param {RequestError} error      Error instance
   * @param {EndpointConfig} requestConfig   Per endpoint request config
   * @returns {AxiosInstance} Provider's instance
   */
  ;

  _proto.outputErrorResponse = function outputErrorResponse(error, requestConfig) {
    try {
      var _exit3 = false;

      var _this3 = this;

      var _temp5 = function _temp5(_result) {
        return _exit3 ? _result : errorHandlingStrategy === 'reject' || errorHandlingStrategy === 'throwError' ? Promise.reject(error) : _this3.defaultResponse;
      };

      var isRequestCancelled = requestConfig.cancelToken && axios.isCancel(error);
      var errorHandlingStrategy = requestConfig.strategy || _this3.strategy; // By default cancelled requests aren't rejected

      if (isRequestCancelled && !requestConfig.rejectCancelled) {
        return Promise.resolve(_this3.defaultResponse);
      }

      var _temp6 = function () {
        if (errorHandlingStrategy === 'silent') {
          // Hang the promise
          return Promise.resolve(new Promise(function () {
            return null;
          })).then(function () {
            var _this$defaultResponse = _this3.defaultResponse;
            _exit3 = true;
            return _this$defaultResponse;
          });
        }
      }();

      return Promise.resolve(_temp6 && _temp6.then ? _temp6.then(_temp5) : _temp5(_temp6)); // Simply rejects a request promise
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
  ;

  _proto.isRequestCancelled = function isRequestCancelled(error, requestConfig) {
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
  ;

  _proto.addCancellationToken = function addCancellationToken(type, url, requestConfig) {
    // Both disabled
    if (!this.cancellable && !requestConfig.cancellable) {
      return {};
    } // Explicitly disabled per request


    if (typeof requestConfig.cancellable !== "undefined" && !requestConfig.cancellable) {
      return {};
    }

    var key = type + "-" + url;
    var previousRequest = this.requestsQueue.get(key);

    if (previousRequest) {
      previousRequest.cancel();
    }

    var tokenSource = axios.CancelToken.source();
    this.requestsQueue.set(key, tokenSource);
    var mappedRequest = this.requestsQueue.get(key) || {};
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
  ;

  _proto.handleRequest = function handleRequest(_ref2) {
    var type = _ref2.type,
        url = _ref2.url,
        _ref2$data = _ref2.data,
        data = _ref2$data === void 0 ? null : _ref2$data,
        _ref2$config = _ref2.config,
        config = _ref2$config === void 0 ? null : _ref2$config;

    try {
      var _exit4 = false;

      var _this4 = this;

      var _temp7 = function _temp7(_result2) {
        return _exit4 ? _result2 : _this4.processResponseData(response);
      };

      var response = null;
      var endpointConfig = config || {};

      var requestConfig = _this4.buildRequestConfig(type, url, data, endpointConfig);

      requestConfig = _extends({}, _this4.addCancellationToken(type, url, requestConfig), requestConfig);

      var _temp8 = _catch(function () {
        return Promise.resolve(_this4.requestInstance.request(requestConfig)).then(function (_this2$requestInstanc) {
          response = _this2$requestInstanc;
        });
      }, function (error) {
        _this4.processRequestError(error, requestConfig);

        var _this2$outputErrorRes = _this4.outputErrorResponse(error, requestConfig);

        _exit4 = true;
        return _this2$outputErrorRes;
      });

      return Promise.resolve(_temp8 && _temp8.then ? _temp8.then(_temp7) : _temp7(_temp8));
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
  ;

  _proto.processResponseData = function processResponseData(response) {
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
  };

  return HttpRequestHandler;
}();

HttpRequestHandler = /*#__PURE__*/__decorate([applyMagic], HttpRequestHandler);

/**
 * Handles dispatching of API requests
 */

var ApiHandler = /*#__PURE__*/function () {
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
  function ApiHandler(_ref) {
    var apiUrl = _ref.apiUrl,
        apiEndpoints = _ref.apiEndpoints,
        _ref$timeout = _ref.timeout,
        timeout = _ref$timeout === void 0 ? null : _ref$timeout,
        _ref$cancellable = _ref.cancellable,
        cancellable = _ref$cancellable === void 0 ? false : _ref$cancellable,
        _ref$strategy = _ref.strategy,
        strategy = _ref$strategy === void 0 ? null : _ref$strategy,
        _ref$flattenResponse = _ref.flattenResponse,
        flattenResponse = _ref$flattenResponse === void 0 ? null : _ref$flattenResponse,
        _ref$defaultResponse = _ref.defaultResponse,
        defaultResponse = _ref$defaultResponse === void 0 ? {} : _ref$defaultResponse,
        _ref$logger = _ref.logger,
        logger = _ref$logger === void 0 ? null : _ref$logger,
        _ref$onError = _ref.onError,
        onError = _ref$onError === void 0 ? null : _ref$onError,
        config = _objectWithoutPropertiesLoose(_ref, ["apiUrl", "apiEndpoints", "timeout", "cancellable", "strategy", "flattenResponse", "defaultResponse", "logger", "onError"]);

    /**
     * Api Url
     */
    this.apiUrl = '';
    this.apiUrl = apiUrl;
    this.apiEndpoints = apiEndpoints;
    this.logger = logger;
    this.httpRequestHandler = new HttpRequestHandler(_extends({}, config, {
      baseURL: this.apiUrl,
      timeout: timeout,
      cancellable: cancellable,
      strategy: strategy,
      flattenResponse: flattenResponse,
      defaultResponse: defaultResponse,
      logger: logger,
      onError: onError
    }));
  }
  /**
   * Get Provider Instance
   *
   * @returns {AxiosInstance} Provider's instance
   */


  var _proto = ApiHandler.prototype;

  _proto.getInstance = function getInstance() {
    return this.httpRequestHandler.getInstance();
  }
  /**
   * Maps all API requests
   *
   * @param {*} prop          Caller
   * @returns {Function}      Tailored request function
   */
  ;

  _proto.__get = function __get(prop) {
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
  ;

  _proto.handleRequest = function handleRequest() {
    try {
      var _this2 = this;

      var prop = arguments.length <= 0 ? undefined : arguments[0];
      var endpointSettings = _this2.apiEndpoints[prop];
      var queryParams = (arguments.length <= 1 ? undefined : arguments[1]) || {};
      var uriParams = (arguments.length <= 2 ? undefined : arguments[2]) || {};
      var requestConfig = (arguments.length <= 3 ? undefined : arguments[3]) || {};
      var uri = endpointSettings.url.replace(/:[a-z]+/ig, function (str) {
        return uriParams[str.substr(1)] ? uriParams[str.substr(1)] : str;
      });
      var responseData = null;

      var additionalRequestSettings = _extends({}, endpointSettings);

      delete additionalRequestSettings.url;
      delete additionalRequestSettings.method;
      return Promise.resolve(_this2.httpRequestHandler[(endpointSettings.method || 'get').toLowerCase()](uri, queryParams, _extends({}, requestConfig, additionalRequestSettings))).then(function (_this$httpRequestHand) {
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
  ;

  _proto.handleNonImplemented = function handleNonImplemented(prop) {
    if (this.logger && this.logger.log) {
      this.logger.log(prop + " endpoint not implemented.");
    }

    return Promise.resolve(null);
  };

  return ApiHandler;
}();

ApiHandler = /*#__PURE__*/__decorate([applyMagic], ApiHandler);
var createApiFetcher = function createApiFetcher(options) {
  return new ApiHandler(options);
};

export { ApiHandler, HttpRequestErrorHandler, HttpRequestHandler, createApiFetcher };
//# sourceMappingURL=index.esm.js.map

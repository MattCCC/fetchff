import { __decorate } from 'tslib';
import { applyMagic } from 'js-magic';
import axios from 'axios';

function _regeneratorRuntime() {
  /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/facebook/regenerator/blob/main/LICENSE */

  _regeneratorRuntime = function () {
    return exports;
  };

  var exports = {},
      Op = Object.prototype,
      hasOwn = Op.hasOwnProperty,
      $Symbol = "function" == typeof Symbol ? Symbol : {},
      iteratorSymbol = $Symbol.iterator || "@@iterator",
      asyncIteratorSymbol = $Symbol.asyncIterator || "@@asyncIterator",
      toStringTagSymbol = $Symbol.toStringTag || "@@toStringTag";

  function define(obj, key, value) {
    return Object.defineProperty(obj, key, {
      value: value,
      enumerable: !0,
      configurable: !0,
      writable: !0
    }), obj[key];
  }

  try {
    define({}, "");
  } catch (err) {
    define = function (obj, key, value) {
      return obj[key] = value;
    };
  }

  function wrap(innerFn, outerFn, self, tryLocsList) {
    var protoGenerator = outerFn && outerFn.prototype instanceof Generator ? outerFn : Generator,
        generator = Object.create(protoGenerator.prototype),
        context = new Context(tryLocsList || []);
    return generator._invoke = function (innerFn, self, context) {
      var state = "suspendedStart";
      return function (method, arg) {
        if ("executing" === state) throw new Error("Generator is already running");

        if ("completed" === state) {
          if ("throw" === method) throw arg;
          return doneResult();
        }

        for (context.method = method, context.arg = arg;;) {
          var delegate = context.delegate;

          if (delegate) {
            var delegateResult = maybeInvokeDelegate(delegate, context);

            if (delegateResult) {
              if (delegateResult === ContinueSentinel) continue;
              return delegateResult;
            }
          }

          if ("next" === context.method) context.sent = context._sent = context.arg;else if ("throw" === context.method) {
            if ("suspendedStart" === state) throw state = "completed", context.arg;
            context.dispatchException(context.arg);
          } else "return" === context.method && context.abrupt("return", context.arg);
          state = "executing";
          var record = tryCatch(innerFn, self, context);

          if ("normal" === record.type) {
            if (state = context.done ? "completed" : "suspendedYield", record.arg === ContinueSentinel) continue;
            return {
              value: record.arg,
              done: context.done
            };
          }

          "throw" === record.type && (state = "completed", context.method = "throw", context.arg = record.arg);
        }
      };
    }(innerFn, self, context), generator;
  }

  function tryCatch(fn, obj, arg) {
    try {
      return {
        type: "normal",
        arg: fn.call(obj, arg)
      };
    } catch (err) {
      return {
        type: "throw",
        arg: err
      };
    }
  }

  exports.wrap = wrap;
  var ContinueSentinel = {};

  function Generator() {}

  function GeneratorFunction() {}

  function GeneratorFunctionPrototype() {}

  var IteratorPrototype = {};
  define(IteratorPrototype, iteratorSymbol, function () {
    return this;
  });
  var getProto = Object.getPrototypeOf,
      NativeIteratorPrototype = getProto && getProto(getProto(values([])));
  NativeIteratorPrototype && NativeIteratorPrototype !== Op && hasOwn.call(NativeIteratorPrototype, iteratorSymbol) && (IteratorPrototype = NativeIteratorPrototype);
  var Gp = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(IteratorPrototype);

  function defineIteratorMethods(prototype) {
    ["next", "throw", "return"].forEach(function (method) {
      define(prototype, method, function (arg) {
        return this._invoke(method, arg);
      });
    });
  }

  function AsyncIterator(generator, PromiseImpl) {
    function invoke(method, arg, resolve, reject) {
      var record = tryCatch(generator[method], generator, arg);

      if ("throw" !== record.type) {
        var result = record.arg,
            value = result.value;
        return value && "object" == typeof value && hasOwn.call(value, "__await") ? PromiseImpl.resolve(value.__await).then(function (value) {
          invoke("next", value, resolve, reject);
        }, function (err) {
          invoke("throw", err, resolve, reject);
        }) : PromiseImpl.resolve(value).then(function (unwrapped) {
          result.value = unwrapped, resolve(result);
        }, function (error) {
          return invoke("throw", error, resolve, reject);
        });
      }

      reject(record.arg);
    }

    var previousPromise;

    this._invoke = function (method, arg) {
      function callInvokeWithMethodAndArg() {
        return new PromiseImpl(function (resolve, reject) {
          invoke(method, arg, resolve, reject);
        });
      }

      return previousPromise = previousPromise ? previousPromise.then(callInvokeWithMethodAndArg, callInvokeWithMethodAndArg) : callInvokeWithMethodAndArg();
    };
  }

  function maybeInvokeDelegate(delegate, context) {
    var method = delegate.iterator[context.method];

    if (undefined === method) {
      if (context.delegate = null, "throw" === context.method) {
        if (delegate.iterator.return && (context.method = "return", context.arg = undefined, maybeInvokeDelegate(delegate, context), "throw" === context.method)) return ContinueSentinel;
        context.method = "throw", context.arg = new TypeError("The iterator does not provide a 'throw' method");
      }

      return ContinueSentinel;
    }

    var record = tryCatch(method, delegate.iterator, context.arg);
    if ("throw" === record.type) return context.method = "throw", context.arg = record.arg, context.delegate = null, ContinueSentinel;
    var info = record.arg;
    return info ? info.done ? (context[delegate.resultName] = info.value, context.next = delegate.nextLoc, "return" !== context.method && (context.method = "next", context.arg = undefined), context.delegate = null, ContinueSentinel) : info : (context.method = "throw", context.arg = new TypeError("iterator result is not an object"), context.delegate = null, ContinueSentinel);
  }

  function pushTryEntry(locs) {
    var entry = {
      tryLoc: locs[0]
    };
    1 in locs && (entry.catchLoc = locs[1]), 2 in locs && (entry.finallyLoc = locs[2], entry.afterLoc = locs[3]), this.tryEntries.push(entry);
  }

  function resetTryEntry(entry) {
    var record = entry.completion || {};
    record.type = "normal", delete record.arg, entry.completion = record;
  }

  function Context(tryLocsList) {
    this.tryEntries = [{
      tryLoc: "root"
    }], tryLocsList.forEach(pushTryEntry, this), this.reset(!0);
  }

  function values(iterable) {
    if (iterable) {
      var iteratorMethod = iterable[iteratorSymbol];
      if (iteratorMethod) return iteratorMethod.call(iterable);
      if ("function" == typeof iterable.next) return iterable;

      if (!isNaN(iterable.length)) {
        var i = -1,
            next = function next() {
          for (; ++i < iterable.length;) if (hasOwn.call(iterable, i)) return next.value = iterable[i], next.done = !1, next;

          return next.value = undefined, next.done = !0, next;
        };

        return next.next = next;
      }
    }

    return {
      next: doneResult
    };
  }

  function doneResult() {
    return {
      value: undefined,
      done: !0
    };
  }

  return GeneratorFunction.prototype = GeneratorFunctionPrototype, define(Gp, "constructor", GeneratorFunctionPrototype), define(GeneratorFunctionPrototype, "constructor", GeneratorFunction), GeneratorFunction.displayName = define(GeneratorFunctionPrototype, toStringTagSymbol, "GeneratorFunction"), exports.isGeneratorFunction = function (genFun) {
    var ctor = "function" == typeof genFun && genFun.constructor;
    return !!ctor && (ctor === GeneratorFunction || "GeneratorFunction" === (ctor.displayName || ctor.name));
  }, exports.mark = function (genFun) {
    return Object.setPrototypeOf ? Object.setPrototypeOf(genFun, GeneratorFunctionPrototype) : (genFun.__proto__ = GeneratorFunctionPrototype, define(genFun, toStringTagSymbol, "GeneratorFunction")), genFun.prototype = Object.create(Gp), genFun;
  }, exports.awrap = function (arg) {
    return {
      __await: arg
    };
  }, defineIteratorMethods(AsyncIterator.prototype), define(AsyncIterator.prototype, asyncIteratorSymbol, function () {
    return this;
  }), exports.AsyncIterator = AsyncIterator, exports.async = function (innerFn, outerFn, self, tryLocsList, PromiseImpl) {
    void 0 === PromiseImpl && (PromiseImpl = Promise);
    var iter = new AsyncIterator(wrap(innerFn, outerFn, self, tryLocsList), PromiseImpl);
    return exports.isGeneratorFunction(outerFn) ? iter : iter.next().then(function (result) {
      return result.done ? result.value : iter.next();
    });
  }, defineIteratorMethods(Gp), define(Gp, toStringTagSymbol, "Generator"), define(Gp, iteratorSymbol, function () {
    return this;
  }), define(Gp, "toString", function () {
    return "[object Generator]";
  }), exports.keys = function (object) {
    var keys = [];

    for (var key in object) keys.push(key);

    return keys.reverse(), function next() {
      for (; keys.length;) {
        var key = keys.pop();
        if (key in object) return next.value = key, next.done = !1, next;
      }

      return next.done = !0, next;
    };
  }, exports.values = values, Context.prototype = {
    constructor: Context,
    reset: function (skipTempReset) {
      if (this.prev = 0, this.next = 0, this.sent = this._sent = undefined, this.done = !1, this.delegate = null, this.method = "next", this.arg = undefined, this.tryEntries.forEach(resetTryEntry), !skipTempReset) for (var name in this) "t" === name.charAt(0) && hasOwn.call(this, name) && !isNaN(+name.slice(1)) && (this[name] = undefined);
    },
    stop: function () {
      this.done = !0;
      var rootRecord = this.tryEntries[0].completion;
      if ("throw" === rootRecord.type) throw rootRecord.arg;
      return this.rval;
    },
    dispatchException: function (exception) {
      if (this.done) throw exception;
      var context = this;

      function handle(loc, caught) {
        return record.type = "throw", record.arg = exception, context.next = loc, caught && (context.method = "next", context.arg = undefined), !!caught;
      }

      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i],
            record = entry.completion;
        if ("root" === entry.tryLoc) return handle("end");

        if (entry.tryLoc <= this.prev) {
          var hasCatch = hasOwn.call(entry, "catchLoc"),
              hasFinally = hasOwn.call(entry, "finallyLoc");

          if (hasCatch && hasFinally) {
            if (this.prev < entry.catchLoc) return handle(entry.catchLoc, !0);
            if (this.prev < entry.finallyLoc) return handle(entry.finallyLoc);
          } else if (hasCatch) {
            if (this.prev < entry.catchLoc) return handle(entry.catchLoc, !0);
          } else {
            if (!hasFinally) throw new Error("try statement without catch or finally");
            if (this.prev < entry.finallyLoc) return handle(entry.finallyLoc);
          }
        }
      }
    },
    abrupt: function (type, arg) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];

        if (entry.tryLoc <= this.prev && hasOwn.call(entry, "finallyLoc") && this.prev < entry.finallyLoc) {
          var finallyEntry = entry;
          break;
        }
      }

      finallyEntry && ("break" === type || "continue" === type) && finallyEntry.tryLoc <= arg && arg <= finallyEntry.finallyLoc && (finallyEntry = null);
      var record = finallyEntry ? finallyEntry.completion : {};
      return record.type = type, record.arg = arg, finallyEntry ? (this.method = "next", this.next = finallyEntry.finallyLoc, ContinueSentinel) : this.complete(record);
    },
    complete: function (record, afterLoc) {
      if ("throw" === record.type) throw record.arg;
      return "break" === record.type || "continue" === record.type ? this.next = record.arg : "return" === record.type ? (this.rval = this.arg = record.arg, this.method = "return", this.next = "end") : "normal" === record.type && afterLoc && (this.next = afterLoc), ContinueSentinel;
    },
    finish: function (finallyLoc) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.finallyLoc === finallyLoc) return this.complete(entry.completion, entry.afterLoc), resetTryEntry(entry), ContinueSentinel;
      }
    },
    catch: function (tryLoc) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];

        if (entry.tryLoc === tryLoc) {
          var record = entry.completion;

          if ("throw" === record.type) {
            var thrown = record.arg;
            resetTryEntry(entry);
          }

          return thrown;
        }
      }

      throw new Error("illegal catch attempt");
    },
    delegateYield: function (iterable, resultName, nextLoc) {
      return this.delegate = {
        iterator: values(iterable),
        resultName: resultName,
        nextLoc: nextLoc
      }, "next" === this.method && (this.arg = undefined), ContinueSentinel;
    }
  }, exports;
}

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) {
  try {
    var info = gen[key](arg);
    var value = info.value;
  } catch (error) {
    reject(error);
    return;
  }

  if (info.done) {
    resolve(value);
  } else {
    Promise.resolve(value).then(_next, _throw);
  }
}

function _asyncToGenerator(fn) {
  return function () {
    var self = this,
        args = arguments;
    return new Promise(function (resolve, reject) {
      var gen = fn.apply(self, args);

      function _next(value) {
        asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value);
      }

      function _throw(err) {
        asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err);
      }

      _next(undefined);
    });
  };
}

function _extends() {
  _extends = Object.assign ? Object.assign.bind() : function (target) {
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

var _excluded = ["baseURL", "timeout", "cancellable", "strategy", "flattenResponse", "defaultResponse", "logger", "onError"];
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
        config = _objectWithoutPropertiesLoose(_ref, _excluded);

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

  _proto.outputErrorResponse =
  /*#__PURE__*/
  function () {
    var _outputErrorResponse = /*#__PURE__*/_asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee(error, requestConfig) {
      var isRequestCancelled, errorHandlingStrategy;
      return _regeneratorRuntime().wrap(function _callee$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              isRequestCancelled = requestConfig.cancelToken && axios.isCancel(error);
              errorHandlingStrategy = requestConfig.strategy || this.strategy; // By default cancelled requests aren't rejected

              if (!(isRequestCancelled && !requestConfig.rejectCancelled)) {
                _context.next = 4;
                break;
              }

              return _context.abrupt("return", this.defaultResponse);

            case 4:
              if (!(errorHandlingStrategy === 'silent')) {
                _context.next = 8;
                break;
              }

              _context.next = 7;
              return new Promise(function () {
                return null;
              });

            case 7:
              return _context.abrupt("return", this.defaultResponse);

            case 8:
              if (!(errorHandlingStrategy === 'reject' || errorHandlingStrategy === 'throwError')) {
                _context.next = 10;
                break;
              }

              return _context.abrupt("return", Promise.reject(error));

            case 10:
              return _context.abrupt("return", this.defaultResponse);

            case 11:
            case "end":
              return _context.stop();
          }
        }
      }, _callee, this);
    }));

    function outputErrorResponse(_x, _x2) {
      return _outputErrorResponse.apply(this, arguments);
    }

    return outputErrorResponse;
  }()
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

  _proto.handleRequest =
  /*#__PURE__*/
  function () {
    var _handleRequest = /*#__PURE__*/_asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee2(_ref2) {
      var type, url, _ref2$data, data, _ref2$config, config, response, endpointConfig, requestConfig;

      return _regeneratorRuntime().wrap(function _callee2$(_context2) {
        while (1) {
          switch (_context2.prev = _context2.next) {
            case 0:
              type = _ref2.type, url = _ref2.url, _ref2$data = _ref2.data, data = _ref2$data === void 0 ? null : _ref2$data, _ref2$config = _ref2.config, config = _ref2$config === void 0 ? null : _ref2$config;
              response = null;
              endpointConfig = config || {};
              requestConfig = this.buildRequestConfig(type, url, data, endpointConfig);
              requestConfig = _extends({}, this.addCancellationToken(type, url, requestConfig), requestConfig);
              _context2.prev = 5;
              _context2.next = 8;
              return this.requestInstance.request(requestConfig);

            case 8:
              response = _context2.sent;
              _context2.next = 15;
              break;

            case 11:
              _context2.prev = 11;
              _context2.t0 = _context2["catch"](5);
              this.processRequestError(_context2.t0, requestConfig);
              return _context2.abrupt("return", this.outputErrorResponse(_context2.t0, requestConfig));

            case 15:
              return _context2.abrupt("return", this.processResponseData(response));

            case 16:
            case "end":
              return _context2.stop();
          }
        }
      }, _callee2, this, [[5, 11]]);
    }));

    function handleRequest(_x3) {
      return _handleRequest.apply(this, arguments);
    }

    return handleRequest;
  }()
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

var _excluded$1 = ["apiUrl", "apiEndpoints", "timeout", "cancellable", "strategy", "flattenResponse", "defaultResponse", "logger", "onError"];
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
        config = _objectWithoutPropertiesLoose(_ref, _excluded$1);

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

  _proto.handleRequest =
  /*#__PURE__*/
  function () {
    var _handleRequest = /*#__PURE__*/_asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee() {
      var prop,
          endpointSettings,
          queryParams,
          uriParams,
          requestConfig,
          uri,
          responseData,
          additionalRequestSettings,
          _args = arguments;
      return _regeneratorRuntime().wrap(function _callee$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              prop = _args.length <= 0 ? undefined : _args[0];
              endpointSettings = this.apiEndpoints[prop];
              queryParams = (_args.length <= 1 ? undefined : _args[1]) || {};
              uriParams = (_args.length <= 2 ? undefined : _args[2]) || {};
              requestConfig = (_args.length <= 3 ? undefined : _args[3]) || {};
              uri = endpointSettings.url.replace(/:[a-z]+/gi, function (str) {
                return uriParams[str.substring(1)] ? uriParams[str.substring(1)] : str;
              });
              responseData = null;
              additionalRequestSettings = _extends({}, endpointSettings);
              delete additionalRequestSettings.url;
              delete additionalRequestSettings.method;
              _context.next = 12;
              return this.httpRequestHandler[(endpointSettings.method || 'get').toLowerCase()](uri, queryParams, _extends({}, requestConfig, additionalRequestSettings));

            case 12:
              responseData = _context.sent;
              return _context.abrupt("return", responseData);

            case 14:
            case "end":
              return _context.stop();
          }
        }
      }, _callee, this);
    }));

    function handleRequest() {
      return _handleRequest.apply(this, arguments);
    }

    return handleRequest;
  }()
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

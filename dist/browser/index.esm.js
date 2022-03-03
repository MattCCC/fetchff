import { __decorate } from 'tslib';
import { applyMagic } from 'js-magic';
import axios from 'axios';

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

function createCommonjsModule(fn, module) {
	return module = { exports: {} }, fn(module, module.exports), module.exports;
}

var runtime_1 = createCommonjsModule(function (module) {
/**
 * Copyright (c) 2014-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

var runtime = (function (exports) {

  var Op = Object.prototype;
  var hasOwn = Op.hasOwnProperty;
  var undefined$1; // More compressible than void 0.
  var $Symbol = typeof Symbol === "function" ? Symbol : {};
  var iteratorSymbol = $Symbol.iterator || "@@iterator";
  var asyncIteratorSymbol = $Symbol.asyncIterator || "@@asyncIterator";
  var toStringTagSymbol = $Symbol.toStringTag || "@@toStringTag";

  function define(obj, key, value) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
    return obj[key];
  }
  try {
    // IE 8 has a broken Object.defineProperty that only works on DOM objects.
    define({}, "");
  } catch (err) {
    define = function(obj, key, value) {
      return obj[key] = value;
    };
  }

  function wrap(innerFn, outerFn, self, tryLocsList) {
    // If outerFn provided and outerFn.prototype is a Generator, then outerFn.prototype instanceof Generator.
    var protoGenerator = outerFn && outerFn.prototype instanceof Generator ? outerFn : Generator;
    var generator = Object.create(protoGenerator.prototype);
    var context = new Context(tryLocsList || []);

    // The ._invoke method unifies the implementations of the .next,
    // .throw, and .return methods.
    generator._invoke = makeInvokeMethod(innerFn, self, context);

    return generator;
  }
  exports.wrap = wrap;

  // Try/catch helper to minimize deoptimizations. Returns a completion
  // record like context.tryEntries[i].completion. This interface could
  // have been (and was previously) designed to take a closure to be
  // invoked without arguments, but in all the cases we care about we
  // already have an existing method we want to call, so there's no need
  // to create a new function object. We can even get away with assuming
  // the method takes exactly one argument, since that happens to be true
  // in every case, so we don't have to touch the arguments object. The
  // only additional allocation required is the completion record, which
  // has a stable shape and so hopefully should be cheap to allocate.
  function tryCatch(fn, obj, arg) {
    try {
      return { type: "normal", arg: fn.call(obj, arg) };
    } catch (err) {
      return { type: "throw", arg: err };
    }
  }

  var GenStateSuspendedStart = "suspendedStart";
  var GenStateSuspendedYield = "suspendedYield";
  var GenStateExecuting = "executing";
  var GenStateCompleted = "completed";

  // Returning this object from the innerFn has the same effect as
  // breaking out of the dispatch switch statement.
  var ContinueSentinel = {};

  // Dummy constructor functions that we use as the .constructor and
  // .constructor.prototype properties for functions that return Generator
  // objects. For full spec compliance, you may wish to configure your
  // minifier not to mangle the names of these two functions.
  function Generator() {}
  function GeneratorFunction() {}
  function GeneratorFunctionPrototype() {}

  // This is a polyfill for %IteratorPrototype% for environments that
  // don't natively support it.
  var IteratorPrototype = {};
  IteratorPrototype[iteratorSymbol] = function () {
    return this;
  };

  var getProto = Object.getPrototypeOf;
  var NativeIteratorPrototype = getProto && getProto(getProto(values([])));
  if (NativeIteratorPrototype &&
      NativeIteratorPrototype !== Op &&
      hasOwn.call(NativeIteratorPrototype, iteratorSymbol)) {
    // This environment has a native %IteratorPrototype%; use it instead
    // of the polyfill.
    IteratorPrototype = NativeIteratorPrototype;
  }

  var Gp = GeneratorFunctionPrototype.prototype =
    Generator.prototype = Object.create(IteratorPrototype);
  GeneratorFunction.prototype = Gp.constructor = GeneratorFunctionPrototype;
  GeneratorFunctionPrototype.constructor = GeneratorFunction;
  GeneratorFunction.displayName = define(
    GeneratorFunctionPrototype,
    toStringTagSymbol,
    "GeneratorFunction"
  );

  // Helper for defining the .next, .throw, and .return methods of the
  // Iterator interface in terms of a single ._invoke method.
  function defineIteratorMethods(prototype) {
    ["next", "throw", "return"].forEach(function(method) {
      define(prototype, method, function(arg) {
        return this._invoke(method, arg);
      });
    });
  }

  exports.isGeneratorFunction = function(genFun) {
    var ctor = typeof genFun === "function" && genFun.constructor;
    return ctor
      ? ctor === GeneratorFunction ||
        // For the native GeneratorFunction constructor, the best we can
        // do is to check its .name property.
        (ctor.displayName || ctor.name) === "GeneratorFunction"
      : false;
  };

  exports.mark = function(genFun) {
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(genFun, GeneratorFunctionPrototype);
    } else {
      genFun.__proto__ = GeneratorFunctionPrototype;
      define(genFun, toStringTagSymbol, "GeneratorFunction");
    }
    genFun.prototype = Object.create(Gp);
    return genFun;
  };

  // Within the body of any async function, `await x` is transformed to
  // `yield regeneratorRuntime.awrap(x)`, so that the runtime can test
  // `hasOwn.call(value, "__await")` to determine if the yielded value is
  // meant to be awaited.
  exports.awrap = function(arg) {
    return { __await: arg };
  };

  function AsyncIterator(generator, PromiseImpl) {
    function invoke(method, arg, resolve, reject) {
      var record = tryCatch(generator[method], generator, arg);
      if (record.type === "throw") {
        reject(record.arg);
      } else {
        var result = record.arg;
        var value = result.value;
        if (value &&
            typeof value === "object" &&
            hasOwn.call(value, "__await")) {
          return PromiseImpl.resolve(value.__await).then(function(value) {
            invoke("next", value, resolve, reject);
          }, function(err) {
            invoke("throw", err, resolve, reject);
          });
        }

        return PromiseImpl.resolve(value).then(function(unwrapped) {
          // When a yielded Promise is resolved, its final value becomes
          // the .value of the Promise<{value,done}> result for the
          // current iteration.
          result.value = unwrapped;
          resolve(result);
        }, function(error) {
          // If a rejected Promise was yielded, throw the rejection back
          // into the async generator function so it can be handled there.
          return invoke("throw", error, resolve, reject);
        });
      }
    }

    var previousPromise;

    function enqueue(method, arg) {
      function callInvokeWithMethodAndArg() {
        return new PromiseImpl(function(resolve, reject) {
          invoke(method, arg, resolve, reject);
        });
      }

      return previousPromise =
        // If enqueue has been called before, then we want to wait until
        // all previous Promises have been resolved before calling invoke,
        // so that results are always delivered in the correct order. If
        // enqueue has not been called before, then it is important to
        // call invoke immediately, without waiting on a callback to fire,
        // so that the async generator function has the opportunity to do
        // any necessary setup in a predictable way. This predictability
        // is why the Promise constructor synchronously invokes its
        // executor callback, and why async functions synchronously
        // execute code before the first await. Since we implement simple
        // async functions in terms of async generators, it is especially
        // important to get this right, even though it requires care.
        previousPromise ? previousPromise.then(
          callInvokeWithMethodAndArg,
          // Avoid propagating failures to Promises returned by later
          // invocations of the iterator.
          callInvokeWithMethodAndArg
        ) : callInvokeWithMethodAndArg();
    }

    // Define the unified helper method that is used to implement .next,
    // .throw, and .return (see defineIteratorMethods).
    this._invoke = enqueue;
  }

  defineIteratorMethods(AsyncIterator.prototype);
  AsyncIterator.prototype[asyncIteratorSymbol] = function () {
    return this;
  };
  exports.AsyncIterator = AsyncIterator;

  // Note that simple async functions are implemented on top of
  // AsyncIterator objects; they just return a Promise for the value of
  // the final result produced by the iterator.
  exports.async = function(innerFn, outerFn, self, tryLocsList, PromiseImpl) {
    if (PromiseImpl === void 0) PromiseImpl = Promise;

    var iter = new AsyncIterator(
      wrap(innerFn, outerFn, self, tryLocsList),
      PromiseImpl
    );

    return exports.isGeneratorFunction(outerFn)
      ? iter // If outerFn is a generator, return the full iterator.
      : iter.next().then(function(result) {
          return result.done ? result.value : iter.next();
        });
  };

  function makeInvokeMethod(innerFn, self, context) {
    var state = GenStateSuspendedStart;

    return function invoke(method, arg) {
      if (state === GenStateExecuting) {
        throw new Error("Generator is already running");
      }

      if (state === GenStateCompleted) {
        if (method === "throw") {
          throw arg;
        }

        // Be forgiving, per 25.3.3.3.3 of the spec:
        // https://people.mozilla.org/~jorendorff/es6-draft.html#sec-generatorresume
        return doneResult();
      }

      context.method = method;
      context.arg = arg;

      while (true) {
        var delegate = context.delegate;
        if (delegate) {
          var delegateResult = maybeInvokeDelegate(delegate, context);
          if (delegateResult) {
            if (delegateResult === ContinueSentinel) continue;
            return delegateResult;
          }
        }

        if (context.method === "next") {
          // Setting context._sent for legacy support of Babel's
          // function.sent implementation.
          context.sent = context._sent = context.arg;

        } else if (context.method === "throw") {
          if (state === GenStateSuspendedStart) {
            state = GenStateCompleted;
            throw context.arg;
          }

          context.dispatchException(context.arg);

        } else if (context.method === "return") {
          context.abrupt("return", context.arg);
        }

        state = GenStateExecuting;

        var record = tryCatch(innerFn, self, context);
        if (record.type === "normal") {
          // If an exception is thrown from innerFn, we leave state ===
          // GenStateExecuting and loop back for another invocation.
          state = context.done
            ? GenStateCompleted
            : GenStateSuspendedYield;

          if (record.arg === ContinueSentinel) {
            continue;
          }

          return {
            value: record.arg,
            done: context.done
          };

        } else if (record.type === "throw") {
          state = GenStateCompleted;
          // Dispatch the exception by looping back around to the
          // context.dispatchException(context.arg) call above.
          context.method = "throw";
          context.arg = record.arg;
        }
      }
    };
  }

  // Call delegate.iterator[context.method](context.arg) and handle the
  // result, either by returning a { value, done } result from the
  // delegate iterator, or by modifying context.method and context.arg,
  // setting context.delegate to null, and returning the ContinueSentinel.
  function maybeInvokeDelegate(delegate, context) {
    var method = delegate.iterator[context.method];
    if (method === undefined$1) {
      // A .throw or .return when the delegate iterator has no .throw
      // method always terminates the yield* loop.
      context.delegate = null;

      if (context.method === "throw") {
        // Note: ["return"] must be used for ES3 parsing compatibility.
        if (delegate.iterator["return"]) {
          // If the delegate iterator has a return method, give it a
          // chance to clean up.
          context.method = "return";
          context.arg = undefined$1;
          maybeInvokeDelegate(delegate, context);

          if (context.method === "throw") {
            // If maybeInvokeDelegate(context) changed context.method from
            // "return" to "throw", let that override the TypeError below.
            return ContinueSentinel;
          }
        }

        context.method = "throw";
        context.arg = new TypeError(
          "The iterator does not provide a 'throw' method");
      }

      return ContinueSentinel;
    }

    var record = tryCatch(method, delegate.iterator, context.arg);

    if (record.type === "throw") {
      context.method = "throw";
      context.arg = record.arg;
      context.delegate = null;
      return ContinueSentinel;
    }

    var info = record.arg;

    if (! info) {
      context.method = "throw";
      context.arg = new TypeError("iterator result is not an object");
      context.delegate = null;
      return ContinueSentinel;
    }

    if (info.done) {
      // Assign the result of the finished delegate to the temporary
      // variable specified by delegate.resultName (see delegateYield).
      context[delegate.resultName] = info.value;

      // Resume execution at the desired location (see delegateYield).
      context.next = delegate.nextLoc;

      // If context.method was "throw" but the delegate handled the
      // exception, let the outer generator proceed normally. If
      // context.method was "next", forget context.arg since it has been
      // "consumed" by the delegate iterator. If context.method was
      // "return", allow the original .return call to continue in the
      // outer generator.
      if (context.method !== "return") {
        context.method = "next";
        context.arg = undefined$1;
      }

    } else {
      // Re-yield the result returned by the delegate method.
      return info;
    }

    // The delegate iterator is finished, so forget it and continue with
    // the outer generator.
    context.delegate = null;
    return ContinueSentinel;
  }

  // Define Generator.prototype.{next,throw,return} in terms of the
  // unified ._invoke helper method.
  defineIteratorMethods(Gp);

  define(Gp, toStringTagSymbol, "Generator");

  // A Generator should always return itself as the iterator object when the
  // @@iterator function is called on it. Some browsers' implementations of the
  // iterator prototype chain incorrectly implement this, causing the Generator
  // object to not be returned from this call. This ensures that doesn't happen.
  // See https://github.com/facebook/regenerator/issues/274 for more details.
  Gp[iteratorSymbol] = function() {
    return this;
  };

  Gp.toString = function() {
    return "[object Generator]";
  };

  function pushTryEntry(locs) {
    var entry = { tryLoc: locs[0] };

    if (1 in locs) {
      entry.catchLoc = locs[1];
    }

    if (2 in locs) {
      entry.finallyLoc = locs[2];
      entry.afterLoc = locs[3];
    }

    this.tryEntries.push(entry);
  }

  function resetTryEntry(entry) {
    var record = entry.completion || {};
    record.type = "normal";
    delete record.arg;
    entry.completion = record;
  }

  function Context(tryLocsList) {
    // The root entry object (effectively a try statement without a catch
    // or a finally block) gives us a place to store values thrown from
    // locations where there is no enclosing try statement.
    this.tryEntries = [{ tryLoc: "root" }];
    tryLocsList.forEach(pushTryEntry, this);
    this.reset(true);
  }

  exports.keys = function(object) {
    var keys = [];
    for (var key in object) {
      keys.push(key);
    }
    keys.reverse();

    // Rather than returning an object with a next method, we keep
    // things simple and return the next function itself.
    return function next() {
      while (keys.length) {
        var key = keys.pop();
        if (key in object) {
          next.value = key;
          next.done = false;
          return next;
        }
      }

      // To avoid creating an additional object, we just hang the .value
      // and .done properties off the next function object itself. This
      // also ensures that the minifier will not anonymize the function.
      next.done = true;
      return next;
    };
  };

  function values(iterable) {
    if (iterable) {
      var iteratorMethod = iterable[iteratorSymbol];
      if (iteratorMethod) {
        return iteratorMethod.call(iterable);
      }

      if (typeof iterable.next === "function") {
        return iterable;
      }

      if (!isNaN(iterable.length)) {
        var i = -1, next = function next() {
          while (++i < iterable.length) {
            if (hasOwn.call(iterable, i)) {
              next.value = iterable[i];
              next.done = false;
              return next;
            }
          }

          next.value = undefined$1;
          next.done = true;

          return next;
        };

        return next.next = next;
      }
    }

    // Return an iterator with no values.
    return { next: doneResult };
  }
  exports.values = values;

  function doneResult() {
    return { value: undefined$1, done: true };
  }

  Context.prototype = {
    constructor: Context,

    reset: function(skipTempReset) {
      this.prev = 0;
      this.next = 0;
      // Resetting context._sent for legacy support of Babel's
      // function.sent implementation.
      this.sent = this._sent = undefined$1;
      this.done = false;
      this.delegate = null;

      this.method = "next";
      this.arg = undefined$1;

      this.tryEntries.forEach(resetTryEntry);

      if (!skipTempReset) {
        for (var name in this) {
          // Not sure about the optimal order of these conditions:
          if (name.charAt(0) === "t" &&
              hasOwn.call(this, name) &&
              !isNaN(+name.slice(1))) {
            this[name] = undefined$1;
          }
        }
      }
    },

    stop: function() {
      this.done = true;

      var rootEntry = this.tryEntries[0];
      var rootRecord = rootEntry.completion;
      if (rootRecord.type === "throw") {
        throw rootRecord.arg;
      }

      return this.rval;
    },

    dispatchException: function(exception) {
      if (this.done) {
        throw exception;
      }

      var context = this;
      function handle(loc, caught) {
        record.type = "throw";
        record.arg = exception;
        context.next = loc;

        if (caught) {
          // If the dispatched exception was caught by a catch block,
          // then let that catch block handle the exception normally.
          context.method = "next";
          context.arg = undefined$1;
        }

        return !! caught;
      }

      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        var record = entry.completion;

        if (entry.tryLoc === "root") {
          // Exception thrown outside of any try block that could handle
          // it, so set the completion value of the entire function to
          // throw the exception.
          return handle("end");
        }

        if (entry.tryLoc <= this.prev) {
          var hasCatch = hasOwn.call(entry, "catchLoc");
          var hasFinally = hasOwn.call(entry, "finallyLoc");

          if (hasCatch && hasFinally) {
            if (this.prev < entry.catchLoc) {
              return handle(entry.catchLoc, true);
            } else if (this.prev < entry.finallyLoc) {
              return handle(entry.finallyLoc);
            }

          } else if (hasCatch) {
            if (this.prev < entry.catchLoc) {
              return handle(entry.catchLoc, true);
            }

          } else if (hasFinally) {
            if (this.prev < entry.finallyLoc) {
              return handle(entry.finallyLoc);
            }

          } else {
            throw new Error("try statement without catch or finally");
          }
        }
      }
    },

    abrupt: function(type, arg) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.tryLoc <= this.prev &&
            hasOwn.call(entry, "finallyLoc") &&
            this.prev < entry.finallyLoc) {
          var finallyEntry = entry;
          break;
        }
      }

      if (finallyEntry &&
          (type === "break" ||
           type === "continue") &&
          finallyEntry.tryLoc <= arg &&
          arg <= finallyEntry.finallyLoc) {
        // Ignore the finally entry if control is not jumping to a
        // location outside the try/catch block.
        finallyEntry = null;
      }

      var record = finallyEntry ? finallyEntry.completion : {};
      record.type = type;
      record.arg = arg;

      if (finallyEntry) {
        this.method = "next";
        this.next = finallyEntry.finallyLoc;
        return ContinueSentinel;
      }

      return this.complete(record);
    },

    complete: function(record, afterLoc) {
      if (record.type === "throw") {
        throw record.arg;
      }

      if (record.type === "break" ||
          record.type === "continue") {
        this.next = record.arg;
      } else if (record.type === "return") {
        this.rval = this.arg = record.arg;
        this.method = "return";
        this.next = "end";
      } else if (record.type === "normal" && afterLoc) {
        this.next = afterLoc;
      }

      return ContinueSentinel;
    },

    finish: function(finallyLoc) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.finallyLoc === finallyLoc) {
          this.complete(entry.completion, entry.afterLoc);
          resetTryEntry(entry);
          return ContinueSentinel;
        }
      }
    },

    "catch": function(tryLoc) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.tryLoc === tryLoc) {
          var record = entry.completion;
          if (record.type === "throw") {
            var thrown = record.arg;
            resetTryEntry(entry);
          }
          return thrown;
        }
      }

      // The context.catch method must only be called with a location
      // argument that corresponds to a known catch block.
      throw new Error("illegal catch attempt");
    },

    delegateYield: function(iterable, resultName, nextLoc) {
      this.delegate = {
        iterator: values(iterable),
        resultName: resultName,
        nextLoc: nextLoc
      };

      if (this.method === "next") {
        // Deliberately forget the last sent value so that we don't
        // accidentally pass it on to the delegate.
        this.arg = undefined$1;
      }

      return ContinueSentinel;
    }
  };

  // Regardless of whether this script is executing as a CommonJS module
  // or not, return the runtime object so that we can declare the variable
  // regeneratorRuntime in the outer scope, which allows this module to be
  // injected easily by `bin/regenerator --include-runtime script.js`.
  return exports;

}(
  // If this script is executing as a CommonJS module, use module.exports
  // as the regeneratorRuntime namespace. Otherwise create a new empty
  // object. Either way, the resulting object will be used to initialize
  // the regeneratorRuntime variable at the top of this file.
   module.exports 
));

try {
  regeneratorRuntime = runtime;
} catch (accidentalStrictMode) {
  // This module should not be running in strict mode, so the above
  // assignment should always work unless something is misconfigured. Just
  // in case runtime.js accidentally runs in strict mode, we can escape
  // strict mode using a global Function call. This could conceivably fail
  // if a Content Security Policy forbids using Function, but in that case
  // the proper solution is to fix the accidental strict mode problem. If
  // you've misconfigured your bundler to force strict mode and applied a
  // CSP to forbid Function, and you're not willing to fix either of those
  // problems, please detail your unique predicament in a GitHub issue.
  Function("r", "regeneratorRuntime = r")(runtime);
}
});

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

  _proto.outputErrorResponse =
  /*#__PURE__*/
  function () {
    var _outputErrorResponse = /*#__PURE__*/_asyncToGenerator( /*#__PURE__*/runtime_1.mark(function _callee(error, requestConfig) {
      var isRequestCancelled, errorHandlingStrategy;
      return runtime_1.wrap(function _callee$(_context) {
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
    var _handleRequest = /*#__PURE__*/_asyncToGenerator( /*#__PURE__*/runtime_1.mark(function _callee2(_ref2) {
      var type, url, _ref2$data, data, _ref2$config, config, response, endpointConfig, requestConfig;

      return runtime_1.wrap(function _callee2$(_context2) {
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

  _proto.handleRequest =
  /*#__PURE__*/
  function () {
    var _handleRequest = /*#__PURE__*/_asyncToGenerator( /*#__PURE__*/runtime_1.mark(function _callee() {
      var prop,
          endpointSettings,
          queryParams,
          uriParams,
          requestConfig,
          uri,
          responseData,
          additionalRequestSettings,
          _args = arguments;
      return runtime_1.wrap(function _callee$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              prop = _args.length <= 0 ? undefined : _args[0];
              endpointSettings = this.apiEndpoints[prop];
              queryParams = (_args.length <= 1 ? undefined : _args[1]) || {};
              uriParams = (_args.length <= 2 ? undefined : _args[2]) || {};
              requestConfig = (_args.length <= 3 ? undefined : _args[3]) || {};
              uri = endpointSettings.url.replace(/:[a-z]+/ig, function (str) {
                return uriParams[str.substr(1)] ? uriParams[str.substr(1)] : str;
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

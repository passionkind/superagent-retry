var retries = require('./retries');


/**
 * Add to the request prototype.
 */

module.exports = function (superagent) {
  var Request = superagent.Request;
  Request.prototype.retry = retry;
  return superagent;
};


/**
 * Export retries for extending
 */

module.exports.retries = retries;


/**
 * Sets the amount of times to retry the request
 * @param  {Number} count
 * @param  {Number} delay time in ms between requests
 * @param  {Function} shouldRetryTestFn manual test fn(err, res, defaultShouldRetry) which can also call defaultShouldRetry if required
 */

function retry (retries, delay, shouldRetryTestFn) {

  var self    = this
    , oldEnd  = this.end;

  var _retries = retries || 1;
  var _delay = delay || 0;

  this.end = function (fn) {
    var timeout = this._timeout;

    function attemptRetry () {
      return oldEnd.call(self, function (err, res) {
        if (!_retries || typeof shouldRetryTestFn === 'function' ? !shouldRetryTestFn(err, res, shouldRetry) : !shouldRetry(err, res)) return fn && fn(err, res);

        reset(self, timeout);

        _retries--;

         if (_retries === retries - 1 && delay) {
           setTimeout(attemptRetry, _delay);
         } else {
           attemptRetry();
         }

      });
    }

    return attemptRetry();
  };

  return this;
}


/**
 * HACK: Resets the internal state of a request.
 */

function reset (request, timeout) {
  var headers = request.req._headers;
  var path = request.req.path;

  request.req.abort();
  request.called = false;
  request.timeout(timeout);
  delete request.req;
  delete request._timer;

  for (var k in headers) {
    request.set(k, headers[k]);
  }

  if (!request.qs) {
    request.req.path = path;
  }
}


/**
 * Determine whether we should retry based upon common error conditions
 * @param  {Error}    err
 * @param  {Response} res
 * @return {Boolean}
 */

function shouldRetry (err, res) {
  return retries.some(function (check) { return check(err, res); });
}

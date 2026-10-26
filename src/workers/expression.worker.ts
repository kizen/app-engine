import {
  buildExpressionResponse,
  handleUncaughtError,
  handleUnhandledRejection,
} from './expression.js';

self.onmessage = (e: MessageEvent<string>): void => {
  self.postMessage(buildExpressionResponse(e.data));
};

// Async plugin code can throw or reject with interpolated record values; keep them out of the
// console. See the handlers for why the error case also posts a sanitized failure.
self.addEventListener('error', (e) => {
  handleUncaughtError(e, (message) => {
    self.postMessage(message);
  });
});

self.addEventListener('unhandledrejection', handleUnhandledRejection);

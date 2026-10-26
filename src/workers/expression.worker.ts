import {
  buildExpressionResponse,
  handleUncaughtError,
  handleUnhandledRejection,
} from './expression.js';

self.onmessage = (e: MessageEvent<string>): void => {
  self.postMessage(buildExpressionResponse(e.data));
};

self.addEventListener('error', (e) => {
  handleUncaughtError(e, (message) => {
    self.postMessage(message);
  });
});

self.addEventListener('unhandledrejection', handleUnhandledRejection);

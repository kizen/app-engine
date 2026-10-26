import { buildExpressionResponse } from './expression.js';

self.onmessage = (e: MessageEvent<string>): void => {
  self.postMessage(buildExpressionResponse(e.data));
};

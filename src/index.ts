export const version = __PKG_VERSION__;

export {
  runScript,
  runExpression,
  runObjectExpression,
  runOptionExpression,
  runStringExpression,
} from './run.js';

export {
  readNavigationContext,
  clearNavigationContext,
  consumeNavigationContext,
} from './communication/storage.js';

export type * from './types/index.js';
export { modalSize } from './types/modals.js';

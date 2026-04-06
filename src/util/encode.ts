import stringify from 'json-stable-stringify';
import { isFlagEnabled } from './flags.js';

export const getHash = (str = ''): number => {
  return str
    .split('')
    .reduce((prevHash, currVal) => ((prevHash << 5) - prevHash + currVal.charCodeAt(0)) | 0, 0);
};

export const getStableHash = (obj: unknown): number => {
  try {
    return getHash(stringify(obj));
  } catch (ex) {
    const isDebug = isFlagEnabled('script-runner-logging');

    if (isDebug) {
      console.warn('Failed to stringify object for hashing:', ex);
    }
    // If there's an error we want to err on the side of always updating,
    // so we return a random hash to ensure that the new value is treated as different from the old value
    return getHash(String(Math.random()));
  }
};

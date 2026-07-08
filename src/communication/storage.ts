import { generateUUIDV4 } from '../util/run.js';

const STORAGE_KEY_PREFIX = 'kizen-app-context';
export const URL_LOAD_PARAM = 'load_storage_key';

const getStorageKey = (): string => {
  const storageId = generateUUIDV4();

  const storageKey = `${STORAGE_KEY_PREFIX}-${storageId}`;

  return storageKey;
};

export const storeNavigationContext = (context: Record<string, unknown>): string => {
  const storageKey = getStorageKey();

  sessionStorage.setItem(storageKey, JSON.stringify(context));

  return storageKey;
};

export const transformNavigationUrl = (url: string, key: string): string => {
  const urlObj = new URL(url, window.location.origin);

  urlObj.searchParams.set(URL_LOAD_PARAM, key);

  return urlObj.toString();
};

export const clearNavigationContext = (key: string): void => {
  sessionStorage.removeItem(key);
};

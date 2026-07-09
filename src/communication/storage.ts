import { generateUUIDV4 } from '../util/run.js';

const STORAGE_KEY_PREFIX = 'kizen-app-context';
export const SESSION_DATA_PARAM = 'session_data_key';

const getStorageKey = (): string => `${STORAGE_KEY_PREFIX}-${generateUUIDV4()}`;

const getStorageKeyFromUrl = (url: string): string | null => {
  try {
    const key = new URL(url, window.location.origin).searchParams.get(SESSION_DATA_PARAM);

    // Only accept keys minted by storeNavigationContext, so a crafted
    // ?session_data_key= can't read or delete unrelated sessionStorage entries.
    return key?.startsWith(`${STORAGE_KEY_PREFIX}-`) ? key : null;
  } catch {
    return null;
  }
};

export const storeNavigationContext = (context: Record<string, unknown>): string => {
  const storageKey = getStorageKey();

  sessionStorage.setItem(storageKey, JSON.stringify(context));

  return storageKey;
};

export const transformNavigationUrl = (url: string, key: string): string => {
  const urlObj = new URL(url, window.location.origin);

  urlObj.searchParams.set(SESSION_DATA_PARAM, key);

  return `${urlObj.pathname}${urlObj.search}${urlObj.hash}`;
};

export const readNavigationContext = (url: string): Record<string, unknown> | undefined => {
  const storageKey = getStorageKeyFromUrl(url);

  if (!storageKey) {
    return undefined;
  }

  try {
    const contextString = sessionStorage.getItem(storageKey);

    if (!contextString) {
      return undefined;
    }

    return JSON.parse(contextString) as Record<string, unknown>;
  } catch {
    return undefined;
  }
};

export const clearNavigationContext = (url: string): void => {
  const storageKey = getStorageKeyFromUrl(url);

  if (storageKey) {
    sessionStorage.removeItem(storageKey);
  }
};

export const consumeNavigationContext = (url: string): Record<string, unknown> | undefined => {
  const context = readNavigationContext(url);

  clearNavigationContext(url);

  return context;
};

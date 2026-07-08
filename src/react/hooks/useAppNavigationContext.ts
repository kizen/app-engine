import { useCallback } from 'react';
import { clearNavigationContext, URL_LOAD_PARAM } from '../../communication/storage.js';

export const useAppNavigationContext = (
  url: string,
): [Record<string, unknown> | undefined, () => void] => {
  const query = new URL(url, window.location.origin).searchParams;

  const storageKey = query.get(URL_LOAD_PARAM);

  const cleanupFn = useCallback(() => {
    if (storageKey) {
      clearNavigationContext(storageKey);
    }
  }, [storageKey]);

  if (!storageKey) {
    return [undefined, cleanupFn];
  }

  try {
    const contextString = sessionStorage.getItem(storageKey);

    if (!contextString) {
      return [undefined, cleanupFn];
    }

    const context = JSON.parse(contextString) as Record<string, unknown>;

    return [context, cleanupFn];
  } catch {
    return [undefined, cleanupFn];
  }
};

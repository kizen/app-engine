import { useCallback, useMemo } from 'react';
import { clearNavigationContext, readNavigationContext } from '../../communication/storage.js';

export const useAppNavigationContext = (
  url: string,
): [Record<string, unknown> | undefined, () => void] => {
  const context = useMemo(() => {
    return readNavigationContext(url);
  }, [url]);

  const clear = useCallback(() => {
    clearNavigationContext(url);
  }, [url]);

  return [context, clear];
};

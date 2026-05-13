import { useMemo } from 'react';
import { getPluginSafeHTML, type RemovedHTML } from '../../util/values.js';

export const usePluginSafeHTML = (
  html?: string,
): { html: string; error: Error | null; removed: RemovedHTML[] } => {
  return useMemo(() => getPluginSafeHTML(html), [html]);
};

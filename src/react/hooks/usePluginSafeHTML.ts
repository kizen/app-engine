import { useMemo } from 'react';
import { getPluginSafeHTML, type RemovedHTML } from '../../util/values.js';

export const usePluginSafeHTML = (
  html?: string,
  pluginApiName?: string,
  useDevMode = false,
): { html: string; error: Error | null; removed: RemovedHTML[] } => {
  return useMemo(
    () => getPluginSafeHTML(html, pluginApiName, useDevMode),
    [html, pluginApiName, useDevMode],
  );
};

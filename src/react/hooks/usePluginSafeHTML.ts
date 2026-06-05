import { useMemo } from 'react';
import { getPluginSafeHTML, type RemovedHTML } from '../../util/values.js';
import type { BuildIframeURLWithProxyOptions } from '../../util/frames.js';

export const usePluginSafeHTML = (
  html?: string,
  pluginApiName?: string,
  options?: BuildIframeURLWithProxyOptions,
): { html: string; error: Error | null; removed: RemovedHTML[] } => {
  return useMemo(
    () => getPluginSafeHTML(html, pluginApiName, options),
    [html, pluginApiName, options],
  );
};

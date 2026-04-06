import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { MaybeMessageError, RoutablePageConfig, UnknownJSON } from '../../types/index.js';
import { useToast } from '../context/toast.js';
import { useGenericPluginCustomScript } from './useGenericPluginCustomScript.js';
import { useManualInteraction, usePluginCustomHTML } from '../index.js';

interface UsePluginEngineReturn {
  scriptUIRef: React.RefObject<HTMLDivElement>;
  outputUIRef: React.RefObject<HTMLDivElement>;
  scopedCss: string;
  sanitizedHtml: string | null;
  interactableScriptRef: React.RefObject<HTMLDivElement>;
  iframeURL?: string | undefined;
  pending: boolean;
}

export const usePluginPage = (
  currentPage?: RoutablePageConfig,
  search?: string,
  isLoading?: boolean,
): UsePluginEngineReturn => {
  const iframeURL = currentPage?.iframe_url;
  const script = currentPage?.script;
  const callback = currentPage?.callback;
  const pluginArgs = currentPage?.args;

  const { showToast } = useToast();

  const scriptUIRef = useRef<HTMLDivElement>(null);

  const [execute, { pending }] = useGenericPluginCustomScript({
    onError: (e) => {
      showToast({
        message: `'Plugin error: ${(e as MaybeMessageError)?.message ?? ''}`,
        variant: 'failure',
      });
    },
    scriptUIRef,
    plugin: currentPage,
  });

  const args = useMemo(() => {
    const queryString = new URLSearchParams(search);
    const query = Object.fromEntries(queryString);

    return {
      ...query,
      ...pluginArgs,
    };
  }, [search, pluginArgs]);

  const { outputUIRef, scopedCss, sanitizedHtml, interactableScriptRef } = usePluginCustomHTML(
    currentPage,
    args,
  );

  useManualInteraction(execute, currentPage, scriptUIRef, pending);

  const hasRunScript = useRef(false);

  useEffect(() => {
    if (!iframeURL && !hasRunScript.current && script && !isLoading) {
      hasRunScript.current = true;
      void execute(script, args);
    }
  }, [iframeURL, execute, script, args, isLoading]);

  const handleMessage = useCallback(
    (e: MessageEvent<{ type: string; query: UnknownJSON } | undefined>) => {
      const message = e.data;

      if (message?.type === 'kizen:plugin_callback') {
        const args = message.query;

        if (callback) {
          void execute(callback, args);
        }
      }
    },
    [execute, callback],
  );

  useEffect(() => {
    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [handleMessage]);

  return {
    scriptUIRef,
    outputUIRef,
    scopedCss,
    sanitizedHtml,
    interactableScriptRef,
    iframeURL,
    pending,
  };
};

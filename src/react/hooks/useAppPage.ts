import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { MaybeMessageError, RoutablePageConfig, UnknownJSON } from '../../types/index.js';
import { useToast } from '../context/toast.js';
import { useTranslation } from '../context/translation.js';
import { useGenericAppCustomScript } from './useGenericAppCustomScript.js';
import {
  useManualInteraction,
  useAppCustomHTML,
  type CollectedFormData,
  type CollectedFormDataResponse,
} from '../index.js';

interface UsePluginEngineReturn {
  scriptUIRef: React.RefObject<HTMLDivElement>;
  outputUIRef: React.RefObject<HTMLDivElement>;
  scopedCss: string;
  sanitizedHtml: string | null;
  interactableScriptRef: React.RefObject<HTMLDivElement>;
  iframeURL?: string | undefined;
  pending: boolean;
  collectFormData: () => CollectedFormDataResponse;
}

export const useAppPage = (
  currentPage?: RoutablePageConfig,
  search?: string,
  isLoading?: boolean,
): UsePluginEngineReturn => {
  const iframeURL = currentPage?.iframe_url;
  const script = currentPage?.script;
  const callback = currentPage?.callback;
  const pluginArgs = currentPage?.args;

  const { showToast } = useToast();
  const { t } = useTranslation();

  const scriptUIRef = useRef<HTMLDivElement>(null);

  const [execute, { pending }] = useGenericAppCustomScript({
    onError: (e) => {
      showToast({
        message: `${t('Plugin error:')} ${(e as MaybeMessageError)?.message ?? ''}`,
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

  const { outputUIRef, scopedCss, sanitizedHtml, interactableScriptRef } = useAppCustomHTML(
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

  const collectFormData = useCallback((): CollectedFormDataResponse => {
    const data: CollectedFormData = {};
    let ready = true;

    [scriptUIRef.current, interactableScriptRef.current].filter(Boolean).forEach((container) => {
      container?.querySelectorAll('form').forEach((form) => {
        if (!form.checkValidity()) {
          form.reportValidity();
          ready = false;
        }

        new FormData(form).forEach((value, key) => {
          data[key] = value;
        });
      });
    });

    return { data, ready };
  }, [interactableScriptRef]);

  return {
    scriptUIRef,
    outputUIRef,
    scopedCss,
    sanitizedHtml,
    interactableScriptRef,
    iframeURL,
    pending,
    collectFormData,
  };
};

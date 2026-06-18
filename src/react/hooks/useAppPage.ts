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
import {
  buildIframeURLWithProxy,
  unwrapProxyMessage,
  type BuildIframeURLWithProxyOptions,
} from '../../util/frames.js';

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
  frameOptions?: BuildIframeURLWithProxyOptions,
): UsePluginEngineReturn => {
  // App-page iframes are proxied for basic embedding only — we intentionally
  // pass no `allow` so the proxy's `&allow=` re-delegation is empty.
  // Plugins that need mic/camera/etc. should use outputIframe()/outputUI() instead.
  const iframeURL = useMemo(
    () =>
      currentPage?.iframe_url
        ? buildIframeURLWithProxy(currentPage.iframe_url, frameOptions).url
        : currentPage?.iframe_url,
    [currentPage?.iframe_url, frameOptions],
  );

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
    frameOptions,
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
    (e: MessageEvent) => {
      const result = unwrapProxyMessage(e);

      if (!result.handled) {
        return;
      }

      const message = result.data as { type: string; query: UnknownJSON } | undefined;

      if (message?.type === 'kizen:plugin_callback') {
        const callbackArgs = message.query;

        if (callback) {
          void execute(callback, callbackArgs);
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

        const formData = new FormData(form);
        for (const key of new Set(formData.keys())) {
          data[key] = formData.getAll(key);
        }
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

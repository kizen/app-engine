import { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react';
import type {
  BlockConfig,
  MaybeMessageError,
  RoutablePageConfig,
  UnknownJSON,
} from '../../types/index.js';
import type { ExecuteGenericScript } from '../../types/artifacts/generic.js';
import { useToast } from '../context/toast.js';
import { useTranslation } from '../context/translation.js';
import { useGenericAppCustomScript } from './useGenericAppCustomScript.js';
import { useManualInteraction } from './useManualInteraction.js';
import { useAppCustomHTML } from './useAppCustomHTML.js';
import { runBlockScriptEventName } from '../../communication/index.js';
import { getStableHash } from '../../util/encode.js';
import { buildIframeURLWithProxy, type BuildIframeURLWithProxyOptions } from '../../util/frames.js';
import type { INDICATOR_TYPE } from '../../communication/constants.js';

interface UseCustomBlockArgs {
  block?: BlockConfig;
  args?: UnknownJSON;
  instanceId: string;
  isLoading?: boolean;
  onError?: (error: unknown) => void;
}

interface UseCustomBlockResult {
  scriptUIRef: RefObject<HTMLDivElement>;
  outputUIRef: RefObject<HTMLDivElement>;
  interactableScriptRef: RefObject<HTMLDivElement>;
  scopedCss: string;
  sanitizedHtml: string | null;
  iframeURL?: string | undefined;
  pending: boolean;
  indicator: INDICATOR_TYPE;
  execute: ExecuteGenericScript;
  runEventScript: (scriptName: string, eventArgs?: Record<string, unknown>) => void;
}

export const useCustomBlock = (
  { block, args, instanceId, isLoading, onError }: UseCustomBlockArgs,
  frameOptions?: BuildIframeURLWithProxyOptions,
): UseCustomBlockResult => {
  const scriptUIRef = useRef<HTMLDivElement>(null);

  const { showToast } = useToast();
  const { t } = useTranslation();

  const pageConfig = useMemo<RoutablePageConfig | undefined>(() => {
    if (!block) {
      return undefined;
    }

    return {
      plugin_api_name: block.plugin_api_name,
      api_name: block.api_name,
      worker_key: instanceId,
      name: block.name,
      type: block.type ?? 'script',
      ...(block.script !== undefined && { script: block.script }),
      ...(block.styles !== undefined && { css: block.styles }),
      ...(block.html !== undefined && { html: block.html }),
      ...(block.iframe_url !== undefined && { iframe_url: block.iframe_url }),
      ...(block.event_scripts !== undefined && { event_scripts: block.event_scripts }),
      ...(block.args !== undefined && { args: block.args }),
    };
  }, [block, instanceId]);

  const [execute, { pending, indicator }] = useGenericAppCustomScript({
    onError: (e) => {
      onError?.(e);
      showToast({
        message: `${t('Plugin error:')} ${(e as MaybeMessageError)?.message ?? ''}`,
        variant: 'failure',
      });
    },
    scriptUIRef,
    plugin: pageConfig,
  });

  const scriptArgs = useMemo<UnknownJSON>(() => ({ ...block?.args, ...args }), [block?.args, args]);

  const iframeURL = useMemo(
    () =>
      block?.iframe_url ? buildIframeURLWithProxy(block.iframe_url, frameOptions).url : undefined,
    [block?.iframe_url, frameOptions],
  );

  const { outputUIRef, scopedCss, sanitizedHtml, interactableScriptRef } = useAppCustomHTML(
    pageConfig,
    scriptArgs,
    frameOptions,
  );

  const runKey = useMemo(
    () =>
      getStableHash({
        plugin: block?.plugin_api_name,
        block: block?.api_name,
        script: block?.script,
        args: scriptArgs,
      }),
    [block?.plugin_api_name, block?.api_name, block?.script, scriptArgs],
  );
  const lastRunKey = useRef<number | null>(null);

  useEffect(() => {
    if (iframeURL || isLoading || !block?.script || lastRunKey.current === runKey) {
      return;
    }

    lastRunKey.current = runKey;
    void execute(block.script, scriptArgs);
  }, [block, scriptArgs, runKey, iframeURL, isLoading, execute]);

  const runEventScript = useCallback(
    (scriptName: string, eventArgs?: Record<string, unknown>): void => {
      const body = block?.event_scripts?.[scriptName];

      if (!body) {
        return;
      }

      void execute(body, { ...eventArgs, ...scriptArgs });
    },
    [block, execute, scriptArgs],
  );

  // Handler for `this.communicate.runBlockScript(...)` calls from another piece
  // of the same plugin
  useEffect(() => {
    if (!block) {
      return;
    }

    const handleRunBlockScript = (e: Event): void => {
      const event = e as
        | {
            detail?: {
              recipient?: { block?: string; plugin?: string; script?: string };
              args?: Record<string, unknown>;
            };
          }
        | undefined;

      const recipient = event?.detail?.recipient;

      if (recipient?.block !== block.api_name || recipient.plugin !== block.plugin_api_name) {
        return;
      }

      const scriptId = recipient.script;
      const scriptBody = scriptId ? block.event_scripts?.[scriptId] : undefined;

      if (scriptBody) {
        void execute(scriptBody, { ...event?.detail?.args, ...scriptArgs });
      }
    };

    window.addEventListener(runBlockScriptEventName, handleRunBlockScript);

    return () => {
      window.removeEventListener(runBlockScriptEventName, handleRunBlockScript);
    };
  }, [block, execute, scriptArgs]);

  // Handler for `data-script` clicks/submits inside the rendered block UI.
  useManualInteraction(execute, block, scriptUIRef, pending, scriptArgs);

  return {
    scriptUIRef,
    outputUIRef,
    interactableScriptRef,
    scopedCss,
    sanitizedHtml,
    iframeURL,
    pending,
    indicator,
    execute,
    runEventScript,
  };
};

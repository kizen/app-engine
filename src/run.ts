import type { SelectOption, UnknownJSON } from './types/common.js';
import type { RunScriptOptions } from './types/run.js';
import { getHash } from './util/encode.js';
import { isFlagEnabled } from './util/flags.js';
import { WorkerManager } from './WorkerManager.js';

export const runScript = async ({
  scriptBody,
  user,
  teamMember,
  business,
  onError,
  onReleaseBlockingScript,
  setLoadingState,
  clientObject,
  scriptUIRef,
  onStateChange,
  workerName,
  context,
  args = '',
  plugin,
  onShowToast,
  onClearToasts,
  terminators,
  executionPlugin,
  sessionData,
  setSessionData,
  onShowModal,
  onCompleteSetup,
  onCloseModal,
  onShowCreateRecordModal,
  onShowCreateRelatedRecordModal,
  onNetworkError,
  onNetworkRequest,
  appPath,
  pushHistory,
  createFileId,
  performFileUpload,
  getPendingCacheCount,
  invalidateCache,
  onConsoleLog,
  onRunEventScript,
}: RunScriptOptions): Promise<unknown> => {
  const isDebug = isFlagEnabled('script-runner-logging');

  let worker: Worker;

  // Webpack detects and bundles workers by precisely matching a statement that looks like this:
  //        new Worker(new URL(<string>, import.meta.url))
  // This means we can't have any part of the building dynamic, and need to create the worker
  // like the following:
  if (workerName === 'recordDetail') {
    worker = new Worker(new URL('./workers/recordDetail.worker.js', import.meta.url), {
      type: 'module',
    });
  } else if (workerName === 'genericPlugin') {
    worker = new Worker(new URL('./workers/generic.worker.js', import.meta.url), {
      type: 'module',
    });
  } else if (workerName === 'floatingFramePlugin') {
    worker = new Worker(new URL('./workers/floatingFrame.worker.js', import.meta.url), {
      type: 'module',
    });
  } else {
    worker = new Worker(new URL('./workers/calendarSource.worker.js', import.meta.url), {
      type: 'module',
    });
  }

  return new Promise((resolve) => {
    const hashedScript = getHash(scriptBody);
    const hashedArgs = getHash(args);

    let workerId = `${plugin?.plugin_api_name ?? ''}-${plugin?.api_name ?? ''}-${plugin?.worker_key ?? ''}-${String(hashedScript)}-${String(hashedArgs)}`;
    let componentId = `${plugin?.plugin_api_name ?? ''}-${plugin?.api_name ?? ''}`;

    if (executionPlugin?.field_type) {
      workerId = `${executionPlugin.plugin_api_name ?? ''}-${executionPlugin.worker_key ?? ''}-${executionPlugin.field_type}-${String(hashedScript)}-${String(hashedArgs)}`;
      componentId = `${executionPlugin.plugin_api_name ?? ''}-${executionPlugin.field_type ?? executionPlugin.script_id}`;
    } else if (executionPlugin) {
      workerId = `${executionPlugin.plugin_api_name ?? ''}-${executionPlugin.worker_key ?? ''}-${executionPlugin.api_name}-${String(hashedScript)}-${String(hashedArgs)}`;
      componentId = `${executionPlugin.plugin_api_name ?? ''}-${executionPlugin.api_name}`;
    }

    if (terminators.current[workerId]) {
      terminators.current[workerId]?.forEach((fn) => {
        fn();
      });

      terminators.current[workerId] = [];
    }

    terminators.current[workerId] ??= [];

    terminators.current[workerId]?.push(() => {
      worker.terminate();
    });

    const instance = new WorkerManager({
      worker,
      done: (preserve: boolean, result?: unknown) => {
        setLoadingState(false);
        if (!preserve) {
          terminators.current[workerId]?.forEach((fn) => {
            fn();
          });
          terminators.current[workerId] = [];
        }
        resolve(result);
      },
      onError,
      onReleaseBlockingScript,
      scriptUIRef,
      onStateChange,
      plugin,
      executionPlugin,
      onShowToast,
      onClearToasts,
      sessionData,
      setSessionData,
      pluginComponentId: componentId,
      onShowModal,
      onCompleteSetup,
      onCloseModal,
      onShowCreateRecordModal,
      onShowCreateRelatedRecordModal,
      onNetworkError,
      pushHistory,
      onNetworkRequest,
      appPath,
      createFileId,
      performFileUpload,
      getPendingCacheCount,
      invalidateCache,
      onConsoleLog,
      onRunEventScript,
      isDebug,
    });

    setLoadingState(true);

    instance.run(
      scriptBody,
      {
        ...context,
        user,
        teamMember,
        business,
        clientObject,
        appPath,
        isDebug,
      },
      args,
    );
  });
};

export const EXPRESSION_TIMEOUT_MS = 20000;

const runUnknownExpression = (
  expression: string,
  values: Record<string, unknown>,
): Promise<unknown> => {
  return new Promise((resolve) => {
    let worker: Worker | undefined;
    let settled = false;

    const settle = (result: unknown, warning?: string): void => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeoutId);
      worker?.terminate();

      if (warning) {
        console.warn(`Plugin expression failed: ${warning}\nExpression: ${expression}`);
      }

      resolve(result);
    };

    const timeoutId = setTimeout(() => {
      settle(null, `timed out after ${String(EXPRESSION_TIMEOUT_MS)}ms`);
    }, EXPRESSION_TIMEOUT_MS);

    try {
      worker = new Worker(new URL('./workers/expression.worker.js', import.meta.url), {
        type: 'module',
      });

      worker.onmessage = (e: MessageEvent) => {
        let parsed: unknown;

        try {
          parsed = JSON.parse(e.data as string);
        } catch {
          settle(null, 'malformed response from expression worker');
          return;
        }

        if (parsed === null || typeof parsed !== 'object') {
          settle(null, 'malformed response from expression worker');
          return;
        }

        const data = parsed as UnknownJSON;

        if (typeof data.error === 'string') {
          settle(null, data.error);
          return;
        }

        settle(data.result);
      };

      worker.onerror = (e: ErrorEvent) => {
        e.preventDefault();
        settle(null, 'uncaught error in expression worker');
      };

      worker.onmessageerror = () => {
        settle(null, 'worker message could not be deserialized');
      };

      const isDebug = isFlagEnabled('script-runner-logging');

      worker.postMessage(JSON.stringify({ expression, args: values, isDebug }));
    } catch {
      settle(null, 'could not start expression worker');
    }
  });
};

export const runExpression = async (expression: string, values: UnknownJSON): Promise<boolean> => {
  const result = await runUnknownExpression(expression, values);

  return result as boolean;
};

export const runStringExpression = async (
  expression: string,
  values: UnknownJSON,
): Promise<string> => {
  const result = await runUnknownExpression(expression, values);

  return result as string;
};

export const runOptionExpression = async (
  expression: string,
  values: UnknownJSON,
): Promise<SelectOption[]> => {
  const result = await runUnknownExpression(expression, values);

  return result as SelectOption[];
};

export const runObjectExpression = async (
  expression: string,
  values: UnknownJSON,
): Promise<Record<string, unknown>> => {
  const result = await runUnknownExpression(expression, values);

  return result as Record<string, unknown>;
};

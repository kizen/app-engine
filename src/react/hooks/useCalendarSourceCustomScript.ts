import { useCallback, useState } from 'react';
import type {
  CalendarSourceConfig,
  ExecuteCalendarSourceScript,
  SchemaValidation,
} from '../../types/artifacts/calendar.js';
import type { MaybeMessageError, UnknownJSON } from '../../types/common.js';
import type { WorkerContextArgs } from '../../types/contexts.js';
import { runScript } from '../../run.js';
import { generateExecutionKey } from '../../util/run.js';
import { useTerminators } from '../context/terminators.js';
import { useSessionData } from '../context/session.js';
import { useAppState } from '../context/appState.js';
import { useRunnerState } from '../context/runnerState.js';
import type { OnShowToastFn } from '../../types/run.js';
import { useModals } from '../context/modals.js';
import { useMonitoring } from '../context/monitoring.js';
import { useHistory } from '../context/history.js';
import { useNetwork } from '../context/network.js';
import { useTranslation } from '../context/translation.js';

interface UseCalendarSourceCustomScriptProps {
  onError: WorkerContextArgs['onError'];
  showToast: OnShowToastFn;
  clearToasts: () => void;
}

const validateSchema = (result: UnknownJSON, schema: SchemaValidation): void => {
  if (!Array.isArray(result)) {
    throw new Error('Return value must be an array');
  }

  schema.required.forEach((requiredField) => {
    result.forEach((resultRow: Record<string, UnknownJSON>, index) => {
      if (!(requiredField.key in resultRow)) {
        throw new Error(
          `Missing required field: ${requiredField.key} in result row ${String(index)}`,
        );
      }

      const actualType = typeof resultRow[requiredField.key];
      if (actualType !== requiredField.type) {
        throw new Error(
          `Invalid type for field: ${requiredField.key} in result row ${String(index)}. Expected ${requiredField.type}, got ${actualType}`,
        );
      }
    });
  });

  schema.optional.forEach((optionalField) => {
    result.forEach((resultRow: Record<string, UnknownJSON>, index: number) => {
      if (optionalField.key in resultRow) {
        const actualType = typeof resultRow[optionalField.key];
        if (actualType !== optionalField.type) {
          throw new Error(
            `Invalid type for field: ${optionalField.key} in result row ${String(index)}. Expected ${optionalField.type}, got ${actualType}`,
          );
        }
      }
    });
  });
};

export const useCalendarSourceCustomScript = ({
  onError,
  showToast,
  clearToasts,
}: UseCalendarSourceCustomScriptProps): [ExecuteCalendarSourceScript, { pending: boolean }] => {
  const { t } = useTranslation();

  const [pending, setPending] = useState(false);
  const [executionKey, setExeutionKey] = useState<string | undefined>(undefined);

  const { terminators } = useTerminators();
  const { sessionData, setSessionData } = useSessionData();
  const {
    installedPluginAPINamesToIds,
    userConfigsByApiName,
    user,
    teamMember,
    business,
    clientObject,
    appPath,
  } = useAppState();

  const { getRunnerState, getRunnerStateUpdater } = useRunnerState();
  const { showModal, showCreateRecordModal, closeCurrentModal } = useModals();

  const { sendException } = useMonitoring();

  const history = useHistory();

  const { performRequest, createFileId, performFileUpload, getPendingCacheCount, invalidateCache } =
    useNetwork();

  const handleError = useCallback(
    (plugin?: CalendarSourceConfig) => (error?: unknown) => {
      onError?.(error);

      const errorMessage = (error as MaybeMessageError)?.message ?? 'Unknown plugin error';

      sendException(new Error(errorMessage), {
        error,
        workerName: 'calendarSource',
        pluginApiName: plugin?.plugin_api_name ?? '',
      });
    },
    [onError, sendException],
  );

  const executeScript = useCallback(
    async (
      scriptBody: string,
      plugin: CalendarSourceConfig,
      args?: Record<string, unknown>,
      schema?: SchemaValidation,
    ) => {
      let stringArgs = '';
      const runnerStateKey = generateExecutionKey(plugin);
      setExeutionKey(runnerStateKey);
      try {
        const pluginAppId = installedPluginAPINamesToIds[plugin.plugin_api_name];
        stringArgs = JSON.stringify({
          ...args,
          pluginId: pluginAppId,
          __kizen_user_config: userConfigsByApiName[plugin.plugin_api_name],
        });
      } catch {
        handleError(plugin)({
          message: t('Arguments passed to the script are invalid'),
        });
      }

      let authError = false;

      const result = await runScript({
        user,
        teamMember,
        business,
        onError: handleError(plugin),
        setLoadingState: setPending,
        scriptBody,
        clientObject,
        onStateChange: (state) => {
          getRunnerStateUpdater(runnerStateKey)((prev) => {
            return {
              ...prev,
              ...state,
            };
          });
        },
        workerName: 'calendarSource',
        args: stringArgs,
        pushHistory: history.push,
        onShowToast: showToast,
        onClearToasts: clearToasts,
        terminators,
        plugin,
        sessionData,
        setSessionData,
        onShowModal: showModal,
        onCloseModal: closeCurrentModal,
        onShowCreateRecordModal: showCreateRecordModal,
        onShowCreateRelatedRecordModal: () => {
          /* empty */
        },
        onNetworkError: (error) => {
          const networkError = error as { message?: string; status?: number } | undefined;

          // A proxied service will respond with 503 if it's not configured correctly, so treat 503 errors as auth errors since that's
          // the most likely scenario.
          if (networkError?.status === 503) {
            authError = true;
          }
        },
        appPath,
        onNetworkRequest: performRequest,
        createFileId,
        performFileUpload,
        getPendingCacheCount,
        invalidateCache,
      });

      try {
        if (schema) {
          validateSchema(result as UnknownJSON, schema);
        }
      } catch (ex) {
        onError?.(ex);
      }

      return { result, authError };
    },
    [
      user,
      teamMember,
      installedPluginAPINamesToIds,
      business,
      clientObject,
      history,
      showToast,
      clearToasts,
      terminators,
      sessionData,
      setSessionData,
      showModal,
      showCreateRecordModal,
      handleError,
      getRunnerStateUpdater,
      userConfigsByApiName,
      onError,
      performRequest,
      createFileId,
      appPath,
      performFileUpload,
      getPendingCacheCount,
      invalidateCache,
      t,
    ],
  );

  return [
    executeScript,
    {
      ...getRunnerState(executionKey),
      pending,
    },
  ];
};

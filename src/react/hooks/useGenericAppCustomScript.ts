import { useCallback, useState } from 'react';
import type { ExecuteGenericScript, GenericPluginConfig } from '../../types/artifacts/generic.js';
import type { WorkerContextArgs } from '../../types/contexts.js';
import { runScript } from '../../run.js';
import { useTerminators } from '../context/terminators.js';
import { useSessionData } from '../context/session.js';
import { useAppState } from '../context/appState.js';
import { useModals } from '../context/modals.js';
import { useMonitoring } from '../context/monitoring.js';
import { useToast } from '../context/toast.js';
import { useHistory } from '../context/history.js';
import type { MaybeMessageError } from '../../types/common.js';
import { generateExecutionKey } from '../../util/run.js';
import { useRunnerState } from '../context/runnerState.js';
import type { CommonExecutionPlugin } from '../../types/run.js';
import { useNetwork } from '../context/network.js';
import { useTranslation } from '../context/translation.js';

interface UseGenericPluginCustomScriptProps {
  onError: WorkerContextArgs['onError'];
  scriptUIRef?: WorkerContextArgs['scriptUIRef'];
  plugin?: GenericPluginConfig | undefined;
}

export const useGenericAppCustomScript = ({
  onError,
  scriptUIRef,
  plugin,
}: UseGenericPluginCustomScriptProps): [ExecuteGenericScript, { pending: boolean }] => {
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

  const { showModal, showCreateRecordModal } = useModals();

  const { sendException } = useMonitoring();

  const { showToast, clearToasts } = useToast();

  const history = useHistory();

  const { performRequest, createFileId, performFileUpload, getPendingCacheCount, invalidateCache } =
    useNetwork();

  const { t } = useTranslation();

  const [pending, setPending] = useState(false);
  const [executionKey, setExeutionKey] = useState<string | undefined>(undefined);

  const handleError = useCallback(
    (error: unknown, executionPlugin?: CommonExecutionPlugin) => {
      onError?.(error);

      const errorMessage = (error as MaybeMessageError)?.message ?? 'Unknown plugin error';
      sendException(new Error(errorMessage), {
        error,
        workerName: 'genericPlugin',
        pluginApiName: plugin?.plugin_api_name ?? executionPlugin?.plugin_api_name ?? '',
      });
    },
    [onError, plugin, sendException],
  );

  const executeScript = useCallback(
    (
      scriptBody: string,
      args?: Record<string, unknown>,
      executionPlugin?: CommonExecutionPlugin,
    ) => {
      let stringArgs = '';
      const runnerStateKey = generateExecutionKey(executionPlugin);
      setExeutionKey(runnerStateKey);
      try {
        const pluginAppId =
          installedPluginAPINamesToIds[
            plugin?.plugin_api_name ?? executionPlugin?.plugin_api_name ?? ''
          ];
        stringArgs = JSON.stringify({
          ...args,
          pluginId: pluginAppId,
          __kizen_user_config:
            userConfigsByApiName[plugin?.plugin_api_name ?? executionPlugin?.plugin_api_name ?? ''],
        });
      } catch {
        handleError({ message: t('Arguments passed to the script are invalid') });
      }

      return runScript({
        user,
        teamMember,
        business,
        onError: handleError,
        setLoadingState: setPending,
        scriptBody,
        clientObject,
        scriptUIRef,
        onStateChange: (state) => {
          getRunnerStateUpdater(runnerStateKey)((prev) => {
            return {
              ...prev,
              ...state,
            };
          });
        },
        workerName: 'genericPlugin',
        args: stringArgs,
        pushHistory: history.push,
        onShowToast: showToast,
        onClearToasts: clearToasts,
        terminators,
        plugin,
        executionPlugin,
        sessionData,
        setSessionData,
        onShowModal: showModal,
        onShowCreateRecordModal: showCreateRecordModal,
        onShowCreateRelatedRecordModal: () => {
          /* empty */
        },
        appPath,
        onNetworkRequest: performRequest,
        createFileId,
        performFileUpload,
        getPendingCacheCount,
        invalidateCache,
      });
    },
    [
      user,
      teamMember,
      installedPluginAPINamesToIds,
      business,
      clientObject,
      scriptUIRef,
      history,
      showToast,
      clearToasts,
      terminators,
      plugin,
      sessionData,
      setSessionData,
      handleError,
      getRunnerStateUpdater,
      userConfigsByApiName,
      showModal,
      showCreateRecordModal,
      performRequest,
      appPath,
      createFileId,
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

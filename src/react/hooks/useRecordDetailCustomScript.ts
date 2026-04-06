import { useCallback, useState } from 'react';
import type { WorkerContextArgs } from '../../types/contexts.js';
import type { CommonExecutionPlugin } from '../../types/run.js';
import type { MaybeMessageError } from '../../types/common.js';
import { useHistory } from '../context/history.js';
import { useToast } from '../context/toast.js';
import { useMonitoring } from '../context/monitoring.js';
import { useModals } from '../context/modals.js';
import { useRunnerState } from '../context/runnerState.js';
import { useAppState } from '../context/appState.js';
import { useSessionData } from '../context/session.js';
import { useTerminators } from '../context/terminators.js';
import { generateExecutionKey } from '../../util/run.js';
import { runScript } from '../../index.js';
import type { ExecuteGenericScript } from '../../types/artifacts/generic.js';
import { useNetwork } from '../context/network.js';

interface UseRecordDetailCustomScriptProps {
  entityId: string;
  objectId: string;
  onError: WorkerContextArgs['onError'];
  scriptUIRef?: WorkerContextArgs['scriptUIRef'];
  onReleaseBlockingScript?: WorkerContextArgs['onReleaseBlockingScript'];
}

export const useRecordDetailCustomScript = ({
  entityId,
  objectId,
  onError,
  scriptUIRef,
  onReleaseBlockingScript,
}: UseRecordDetailCustomScriptProps): [ExecuteGenericScript, { pending: boolean }] => {
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

  const { showModal, showCreateRecordModal, showCreateRelatedRecordModal } = useModals();

  const { sendException } = useMonitoring();

  const { showToast, clearToasts } = useToast();

  const history = useHistory();

  const { performRequest } = useNetwork();

  const [pending, setPending] = useState(false);
  const [executionKey, setExeutionKey] = useState<string | undefined>(undefined);

  const handleError = useCallback(
    (error: unknown, executionPlugin?: CommonExecutionPlugin) => {
      onError?.(error);
      const errorMessage = (error as MaybeMessageError)?.message ?? 'Unknown plugin error';
      sendException(new Error(errorMessage), {
        error,
        workerName: 'recordDetail',
        pluginApiName: executionPlugin?.plugin_api_name ?? '',
        objectId,
        entityId,
      });
    },
    [onError, objectId, entityId, sendException],
  );

  const executeScript = useCallback(
    (
      scriptBody: string,
      args?: Record<string, unknown>,
      executionPlugin?: CommonExecutionPlugin,
      overrideContext?: Record<string, unknown>,
    ) => {
      let stringArgs = '';
      try {
        const pluginAppId = installedPluginAPINamesToIds[executionPlugin?.plugin_api_name ?? ''];
        stringArgs = JSON.stringify({
          ...args,
          pluginId: pluginAppId,
          __kizen_user_config: userConfigsByApiName[executionPlugin?.plugin_api_name ?? ''],
        });
      } catch {
        handleError({ message: 'Arguments passed to the script are invalid' }, executionPlugin);
      }
      const runnerStateKey = generateExecutionKey(executionPlugin);

      setExeutionKey(runnerStateKey);
      return runScript({
        user,
        teamMember,
        business,
        onReleaseBlockingScript,
        onError: (e) => {
          handleError(e, executionPlugin);
        },
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
        workerName: 'recordDetail',
        args: stringArgs,
        context: overrideContext ?? {
          entityId,
          objectId,
        },
        pushHistory: history.push,
        onShowToast: showToast,
        onClearToasts: clearToasts,
        terminators,
        executionPlugin,
        sessionData,
        setSessionData,
        onShowModal: showModal,
        onShowCreateRecordModal: showCreateRecordModal,
        onShowCreateRelatedRecordModal: showCreateRelatedRecordModal,
        appPath,
        onNetworkRequest: performRequest,
      });
    },
    [
      user,
      teamMember,
      installedPluginAPINamesToIds,
      business,
      entityId,
      objectId,
      clientObject,
      scriptUIRef,
      history,
      showToast,
      clearToasts,
      terminators,
      sessionData,
      setSessionData,
      showModal,
      showCreateRecordModal,
      showCreateRelatedRecordModal,
      onReleaseBlockingScript,
      handleError,
      getRunnerStateUpdater,
      userConfigsByApiName,
      performRequest,
      appPath,
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

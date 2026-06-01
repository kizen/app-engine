import { useCallback, useRef, useState } from 'react';
import type {
  ExecuteFloatingFrameScript,
  FloatingFrameConfig,
} from '../../types/artifacts/floatingFrame.js';
import type { WorkerContextArgs } from '../../types/contexts.js';
import { useTerminators } from '../context/terminators.js';
import { useSessionData } from '../context/session.js';
import { useAppState } from '../context/appState.js';
import { useModals } from '../context/modals.js';
import { useMonitoring } from '../context/monitoring.js';
import { useHistory } from '../context/history.js';
import type { MaybeMessageError } from '../../types/common.js';
import { runScript } from '../../run.js';
import { useToast } from '../context/toast.js';
import { flushSync } from 'react-dom';
import { useNetwork } from '../context/network.js';
import { useTranslation } from '../context/translation.js';

interface UseFloatingFrameCustomScriptProps {
  onError: WorkerContextArgs['onError'];
  scriptUIRef?: WorkerContextArgs['scriptUIRef'];
  plugin: FloatingFrameConfig;
  onChangeMinimized?: (minimized: boolean) => void;
}

export const useFloatingFrameCustomScript = ({
  onError,
  scriptUIRef,
  plugin,
  onChangeMinimized,
}: UseFloatingFrameCustomScriptProps): [
  ExecuteFloatingFrameScript,
  {
    pending: boolean;
    hidden: boolean;
    indicator: string;
    triggerHidden?: boolean;
    hideHeader?: boolean;
  },
] => {
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

  const { showModal, showCreateRecordModal, showCreateRelatedRecordModal, closeCurrentModal } =
    useModals();

  const { sendException } = useMonitoring();

  const { showToast, clearToasts } = useToast();

  const history = useHistory();

  const { performRequest, createFileId, performFileUpload, getPendingCacheCount, invalidateCache } =
    useNetwork();

  const { t } = useTranslation();

  const [pending, setPending] = useState(false);

  // use a local runner state instead of global runnerState since all state changes will happen within the context of the iframe
  const [floatingFrameRunnerState, setFloatingFrameRunnerState] = useState({
    indicator: 'none',
    hidden: true,
    triggerHidden: false,
    hideHeader: false,
  });

  const pendingOnceLock = useRef(false);
  const [pendingLocked, setPendingLocked] = useState(false);
  if (pending && !pendingOnceLock.current) {
    pendingOnceLock.current = true;
  }

  if (!pending && pendingOnceLock.current && !pendingLocked) {
    setPendingLocked(true);
  }

  const handleError = useCallback(
    (error: unknown) => {
      onError?.(error);

      const errorMessage = (error as MaybeMessageError)?.message ?? 'Unknown plugin error';
      sendException(new Error(errorMessage), {
        error,
        workerName: 'floatingFrame',
        pluginApiName: plugin.plugin_api_name,
      });
    },
    [onError, plugin, sendException],
  );

  const executeScript = useCallback(
    (scriptBody: string, args?: Record<string, unknown>) => {
      let stringArgs = '';
      try {
        const pluginAppId = installedPluginAPINamesToIds[plugin.plugin_api_name];
        stringArgs = JSON.stringify({
          ...args,
          pluginId: pluginAppId,
          __kizen_user_config: userConfigsByApiName[plugin.plugin_api_name],
        });
      } catch {
        handleError({ message: t('Arguments passed to the script are invalid') });
      }

      return runScript({
        user,
        teamMember,
        business,
        onError: handleError,
        setLoadingState: (...args) => {
          flushSync(() => {
            setPending(...args);
          });
        },
        scriptBody,
        clientObject,
        scriptUIRef,

        onStateChange: (state) => {
          const { minimized, ...rest } = state;
          if (typeof minimized === 'boolean') {
            onChangeMinimized?.(minimized);
          }
          setFloatingFrameRunnerState((s) => {
            return { ...s, ...rest };
          });
        },
        workerName: 'floatingFramePlugin',
        args: stringArgs,
        pushHistory: history.push,
        plugin,
        onShowToast: showToast,
        onClearToasts: clearToasts,
        terminators,
        sessionData,
        setSessionData,
        onShowModal: showModal,
        onCloseModal: closeCurrentModal,
        onShowCreateRecordModal: showCreateRecordModal,
        onShowCreateRelatedRecordModal: showCreateRelatedRecordModal,
        appPath,
        onNetworkRequest: performRequest,
        createFileId,
        performFileUpload,
        getPendingCacheCount,
        invalidateCache,
        onRunEventScript: (scriptName, eventArgs) => {
          const body = plugin.event_scripts?.[scriptName];

          if (!body) {
            handleError({ message: `${t('Event script not found:')} ${scriptName}` });

            return;
          }

          void executeScript(body, eventArgs);
        },
      });
    },
    [
      user,
      teamMember,
      business,
      installedPluginAPINamesToIds,
      clientObject,
      scriptUIRef,
      history,
      plugin,
      onChangeMinimized,
      showToast,
      clearToasts,
      terminators,
      sessionData,
      setSessionData,
      handleError,
      setFloatingFrameRunnerState,
      userConfigsByApiName,
      showModal,
      showCreateRecordModal,
      showCreateRelatedRecordModal,
      performRequest,
      appPath,
      createFileId,
      performFileUpload,
      getPendingCacheCount,
      invalidateCache,
      t,
      closeCurrentModal,
    ],
  );

  return [
    executeScript,
    {
      ...floatingFrameRunnerState,
      pending: pendingLocked ? false : pending,
    },
  ];
};

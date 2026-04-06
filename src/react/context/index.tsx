import { useCallback, useEffect, useMemo, useState, type FC, type ReactNode } from 'react';
import { AppStateWrapper, type AppStateWrapperProps } from './appState.js';
import { RunnerStateWrapper } from './runnerState.js';
import { HistoryWrapper, type HistoryWrapperProps } from './history.js';
import { ModalsWrapper, type ExposedModals, type ModalWrapperContextArgs } from './modals.js';
import { MonitoringWrapper, type MonitoringWrapperProps } from './monitoring.js';
import { SessionDataWrapper } from './session.js';
import { TerminatorsWrapper } from './terminators.js';
import { ToastWrapper, type ToastWrapperProps } from './toast.js';
import { NetworkWrapper, type NetworkWrapperProps } from './network.js';
import { useLocationChange } from '../hooks/useLocationChange.js';

type TouchFloatingFrame = (id: string, cb?: (value: string[]) => void) => void;

interface AdditionalContextProps {
  showLoadingIndicator: boolean;
  touchFloatingFrame: TouchFloatingFrame;
  floatingFrameOffset: Record<string, number>;
  hiddenByModal: boolean;
  hasFinishedBootstrapping: boolean;
  waitingOnRouteScript: boolean;
}
export interface PluginEngineProviderProps
  extends
    Omit<AppStateWrapperProps, 'children'>,
    Omit<HistoryWrapperProps, 'children'>,
    Omit<MonitoringWrapperProps, 'children'>,
    Omit<ToastWrapperProps, 'children'>,
    Omit<NetworkWrapperProps, 'children'> {
  modal: Omit<ModalWrapperContextArgs, 'children'>;
  children: (props: ExposedModals & AdditionalContextProps) => ReactNode;
  hideFramesOnModal?: boolean;
}

export const PluginEngineProvider: FC<PluginEngineProviderProps> = (props) => {
  const {
    children,
    bootstrapPlugins = [],
    userConfigs = [],
    user,
    teamMember,
    business,
    clientObject,
    onNavigate,
    modal,
    monitoringExceptionHelper,
    showToast,
    clearToasts,
    performRequest,
    appPath,
    hideFramesOnModal = true,
  } = props;

  useLocationChange();

  const [floatingFrameOrder, setFloatingFrameOrder] = useState<string[]>([]);
  const [hiddenByModal, setHiddenByModal] = useState(false);

  const touchFloatingFrame = useCallback<TouchFloatingFrame>((id, cb) => {
    setFloatingFrameOrder((prev) => {
      const res = prev.filter((i) => i !== id);
      const done = [id, ...res];

      cb?.(done);

      return done;
    });
  }, []);

  const floatingFrameOffset = useMemo(() => {
    return [...floatingFrameOrder].reverse().reduce((acc, id, index) => {
      return {
        ...acc,
        [id]: index,
      };
    }, {});
  }, [floatingFrameOrder]);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const modal = document.querySelector('div[role="dialog"]');
      if (modal) {
        setHiddenByModal(true);
      } else {
        setHiddenByModal(false);
      }
    });

    observer.observe(document.body, {
      childList: true,
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <AppStateWrapper
      bootstrapPlugins={bootstrapPlugins}
      userConfigs={userConfigs}
      user={user}
      teamMember={teamMember}
      business={business}
      clientObject={clientObject}
      appPath={appPath}
    >
      {({ hasFinishedBootstrapping, waitingOnRouteScript }) => {
        return (
          <RunnerStateWrapper>
            {(showLoadingIndicator) => {
              return (
                <HistoryWrapper onNavigate={onNavigate}>
                  <ModalsWrapper {...modal}>
                    {(modals) => {
                      return (
                        <MonitoringWrapper monitoringExceptionHelper={monitoringExceptionHelper}>
                          <SessionDataWrapper>
                            <TerminatorsWrapper>
                              <ToastWrapper showToast={showToast} clearToasts={clearToasts}>
                                <NetworkWrapper performRequest={performRequest}>
                                  {children({
                                    ...modals,
                                    showLoadingIndicator,
                                    touchFloatingFrame,
                                    floatingFrameOffset,
                                    hiddenByModal: hideFramesOnModal ? hiddenByModal : false,
                                    hasFinishedBootstrapping,
                                    waitingOnRouteScript,
                                  })}
                                </NetworkWrapper>
                              </ToastWrapper>
                            </TerminatorsWrapper>
                          </SessionDataWrapper>
                        </MonitoringWrapper>
                      );
                    }}
                  </ModalsWrapper>
                </HistoryWrapper>
              );
            }}
          </RunnerStateWrapper>
        );
      }}
    </AppStateWrapper>
  );
};

import { type FC, type ReactNode } from 'react';
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
import { FloatingFrameWrapper } from './floatingFrame.js';
import { TranslationWrapper } from './translation.js';

export type TouchFloatingFrame = (id: string, cb?: (value: string[]) => void) => void;

interface AdditionalContextProps {
  showLoadingIndicator: boolean;
  hiddenByModal: boolean;
  hasFinishedBootstrapping: boolean;
  waitingOnRouteScript: boolean;
}
export interface AppEngineProviderProps
  extends
    Omit<AppStateWrapperProps, 'children'>,
    Omit<HistoryWrapperProps, 'children'>,
    Omit<MonitoringWrapperProps, 'children'>,
    Omit<ToastWrapperProps, 'children'>,
    Omit<NetworkWrapperProps, 'children'> {
  modal: Omit<ModalWrapperContextArgs, 'children'>;
  children: (props: ExposedModals & AdditionalContextProps) => ReactNode;
  hideFramesOnModal?: boolean;
  t?: (s: string) => string;
}

export const AppEngineProvider: FC<AppEngineProviderProps> = (props) => {
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
    createFileId,
    performFileUpload,
    t,
  } = props;

  useLocationChange();

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
          <TranslationWrapper t={t}>
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
                                  <FloatingFrameWrapper>
                                    {(hiddenByModal) => {
                                      return (
                                        <NetworkWrapper
                                          performRequest={performRequest}
                                          createFileId={createFileId}
                                          performFileUpload={performFileUpload}
                                        >
                                          {children({
                                            ...modals,
                                            showLoadingIndicator,
                                            hasFinishedBootstrapping,
                                            waitingOnRouteScript,
                                            hiddenByModal: hideFramesOnModal
                                              ? hiddenByModal
                                              : false,
                                          })}
                                        </NetworkWrapper>
                                      );
                                    }}
                                  </FloatingFrameWrapper>
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
          </TranslationWrapper>
        );
      }}
    </AppStateWrapper>
  );
};

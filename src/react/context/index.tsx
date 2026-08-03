import { useContext, type FC, type ReactNode } from 'react';
import { QueryClient, QueryClientContext, QueryClientProvider } from '@tanstack/react-query';
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

const BOOTSTRAP_PLUGINS_FALLBACK: AppStateWrapperProps['bootstrapPlugins'] = [];
const USER_CONFIGS_FALLBACK: AppStateWrapperProps['userConfigs'] = [];

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

const defaultQueryClient = new QueryClient();

const MaybeQueryClientProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const existing = useContext(QueryClientContext);

  if (existing) {
    return <>{children}</>;
  }

  return <QueryClientProvider client={defaultQueryClient}>{children}</QueryClientProvider>;
};

export const AppEngineProvider: FC<AppEngineProviderProps> = (props) => {
  const {
    children,
    bootstrapPlugins,
    userConfigs,
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
    invalidateCache,
    getPendingCacheCount,
    onCompleteSetup,
  } = props;

  useLocationChange();

  return (
    <MaybeQueryClientProvider>
      <AppStateWrapper
        bootstrapPlugins={bootstrapPlugins ?? BOOTSTRAP_PLUGINS_FALLBACK}
        userConfigs={userConfigs ?? USER_CONFIGS_FALLBACK}
        user={user}
        teamMember={teamMember}
        business={business}
        clientObject={clientObject}
        appPath={appPath}
        onCompleteSetup={onCompleteSetup}
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
                            <MonitoringWrapper
                              monitoringExceptionHelper={monitoringExceptionHelper}
                            >
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
                                            invalidateCache={invalidateCache}
                                            getPendingCacheCount={getPendingCacheCount}
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
    </MaybeQueryClientProvider>
  );
};

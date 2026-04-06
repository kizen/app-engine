import { createContext, useCallback, useContext, type FC } from 'react';

export interface Extra {
  error?: unknown;
  workerName: string;
  pluginApiName?: string;
  objectId?: string;
  entityId?: string;
}

export interface MonitoringWrapperProps {
  monitoringExceptionHelper: (error: Error, extra: { extra: Extra }) => void;
  children: React.ReactNode;
}

interface MonitoringContextValue {
  sendException: (error: Error, extra: Extra) => void;
}

const MonitoringContext = createContext<MonitoringContextValue | null>(null);

export const MonitoringWrapper: FC<MonitoringWrapperProps> = ({
  children,
  monitoringExceptionHelper,
}) => {
  const sendException = useCallback(
    (error: Error, extra: Extra) => {
      monitoringExceptionHelper(error, {
        extra,
      });
    },
    [monitoringExceptionHelper],
  );

  return (
    <MonitoringContext.Provider
      value={{
        sendException,
      }}
    >
      {children}
    </MonitoringContext.Provider>
  );
};

export const useMonitoring = (): MonitoringContextValue => {
  const context = useContext(MonitoringContext);

  if (!context) {
    throw new Error('useMonitoring must be used within an MonitoringWrapper');
  }

  return context;
};

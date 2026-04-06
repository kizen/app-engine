import { createContext, useCallback, useContext, useState, type FC, type ReactNode } from 'react';
import type { InternalSessionData, SetInternalSessionDataFn } from '../../types/contexts.js';

interface SessionDataContextValue {
  sessionData: InternalSessionData;
  setSessionData: SetInternalSessionDataFn;
}

const SessionDataContext = createContext<SessionDataContextValue | null>(null);

export const SessionDataWrapper: FC<{
  children: ReactNode;
}> = ({ children }) => {
  const [sessionData, _setSessionData] = useState<InternalSessionData>({});

  const setSessionData = useCallback((pluginId: string, update: InternalSessionData) => {
    _setSessionData((prev) => ({
      ...prev,
      [pluginId]: {
        ...(prev[pluginId] as InternalSessionData),
        ...update,
      },
    }));
  }, []);

  return (
    <SessionDataContext.Provider value={{ sessionData, setSessionData }}>
      {children}
    </SessionDataContext.Provider>
  );
};

export const useSessionData = (): SessionDataContextValue => {
  const context = useContext(SessionDataContext);

  if (!context) {
    throw new Error('useSessionData must be used within a SessionDataWrapper');
  }

  return context;
};

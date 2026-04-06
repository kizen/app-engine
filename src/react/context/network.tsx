import { createContext, useContext, type FC } from 'react';
import type { OnNetworkRequestFn } from '../../types/run.js';

const NetworkContext = createContext<NetworkContextValue | null>(null);

export interface NetworkWrapperProps {
  children: React.ReactNode;
  performRequest: OnNetworkRequestFn;
}

interface NetworkContextValue {
  performRequest: OnNetworkRequestFn;
}

export const NetworkWrapper: FC<NetworkWrapperProps> = ({ children, performRequest }) => {
  return <NetworkContext.Provider value={{ performRequest }}>{children}</NetworkContext.Provider>;
};

export const useNetwork = (): NetworkContextValue => {
  const context = useContext(NetworkContext);

  if (!context) {
    throw new Error('useNetwork must be used within a NetworkWrapper');
  }

  return context;
};

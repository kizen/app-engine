import { createContext, useContext, type FC } from 'react';
import type { CreateFileIdFn, OnNetworkRequestFn } from '../../types/run.js';

const NetworkContext = createContext<NetworkContextValue | null>(null);

export interface NetworkWrapperProps {
  children: React.ReactNode;
  performRequest: OnNetworkRequestFn;
  createFileId?: CreateFileIdFn | undefined;
}

interface NetworkContextValue {
  performRequest: OnNetworkRequestFn;
  createFileId?: CreateFileIdFn | undefined;
}

export const NetworkWrapper: FC<NetworkWrapperProps> = ({
  children,
  performRequest,
  createFileId,
}) => {
  return (
    <NetworkContext.Provider value={{ performRequest, createFileId }}>
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetwork = (): NetworkContextValue => {
  const context = useContext(NetworkContext);

  if (!context) {
    throw new Error('useNetwork must be used within a NetworkWrapper');
  }

  return context;
};

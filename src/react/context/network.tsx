import { createContext, useContext, type FC } from 'react';
import type {
  CreateFileIdFn,
  OnNetworkRequestFn,
  PerformKizenFileUploadFn,
} from '../../types/run.js';

const NetworkContext = createContext<NetworkContextValue | null>(null);

export interface NetworkWrapperProps {
  children: React.ReactNode;
  performRequest: OnNetworkRequestFn;
  createFileId?: CreateFileIdFn | undefined;
  performFileUpload?: PerformKizenFileUploadFn | undefined;
}

interface NetworkContextValue {
  performRequest: OnNetworkRequestFn;
  createFileId?: CreateFileIdFn | undefined;
  performFileUpload?: PerformKizenFileUploadFn | undefined;
}

export const NetworkWrapper: FC<NetworkWrapperProps> = ({
  children,
  performRequest,
  createFileId,
  performFileUpload,
}) => {
  return (
    <NetworkContext.Provider value={{ performRequest, createFileId, performFileUpload }}>
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

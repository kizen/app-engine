import { createContext, useContext, type FC } from 'react';
import type { OnLaunchCodingAssistantFn } from '../../types/run.js';

const CodingAssistantContext = createContext<CodingAssistantContextValue | null>(null);

interface CodingAssistantContextValue {
  launchCodingAssistant?: OnLaunchCodingAssistantFn | undefined;
}

export interface CodingAssistantWrapperProps {
  children: React.ReactNode;
  launchCodingAssistant?: OnLaunchCodingAssistantFn | undefined;
}

export const CodingAssistantWrapper: FC<CodingAssistantWrapperProps> = ({
  children,
  launchCodingAssistant,
}) => {
  return (
    <CodingAssistantContext.Provider value={{ launchCodingAssistant }}>
      {children}
    </CodingAssistantContext.Provider>
  );
};

export const useCodingAssistant = (): CodingAssistantContextValue => {
  const context = useContext(CodingAssistantContext);

  if (!context) {
    throw new Error('useCodingAssistant must be used within a CodingAssistantWrapper');
  }

  return context;
};

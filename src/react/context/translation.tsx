import { createContext, useContext, type FC, type ReactNode } from 'react';

const defaultT = (s: string): string => s;

const TranslationContext = createContext({ t: defaultT });

export type TranslationFunction = (s: string) => string;

export interface TranslationWrapperProps {
  children: ReactNode;
  t?: TranslationFunction | undefined;
}

interface TranslationContextValue {
  t: TranslationFunction;
}

export const TranslationWrapper: FC<TranslationWrapperProps> = (props) => {
  const { children, t = defaultT } = props;

  return <TranslationContext.Provider value={{ t }}>{children}</TranslationContext.Provider>;
};

export const useTranslation = (): TranslationContextValue => {
  const context = useContext(TranslationContext);

  return context;
};

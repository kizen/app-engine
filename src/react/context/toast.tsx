import { createContext, useContext, type FC } from 'react';
import type { OnShowToastFn } from '../../types/run.js';

const ToastContext = createContext<ToastContextValue | null>(null);

interface ToastContextValue {
  showToast: OnShowToastFn;
  clearToasts: () => void;
}

export interface ToastWrapperProps {
  children: React.ReactNode;
  showToast: OnShowToastFn;
  clearToasts: () => void;
}

export const ToastWrapper: FC<ToastWrapperProps> = ({ children, showToast, clearToasts }) => {
  return (
    <ToastContext.Provider value={{ showToast, clearToasts }}>{children}</ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within a ToastWrapper');
  }

  return context;
};

import { useEffect } from 'react';
import { useAppState } from '../context/appState.js';

export const AppBootstrapSuccess = (): null => {
  const { onInitialBootstrap } = useAppState();

  // Run some logic after the app has been fully bootstrapped for the first time (including
  // any plugins that need to block loading)
  useEffect(() => {
    onInitialBootstrap();
  }, [onInitialBootstrap]);

  return null;
};

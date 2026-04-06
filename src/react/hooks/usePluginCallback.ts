import { useEffect } from 'react';

export const usePluginCallback = (search: string): void => {
  useEffect(() => {
    const queryString = new URLSearchParams(search);

    const query = Object.fromEntries(queryString);

    window.parent.postMessage({ type: 'kizen:plugin_callback', query }, '*');
  }, [search]);
};

import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { QUERY_KEYS } from '../../communication/constants.js';

type ResetFn = (pluginApiName: string, sourceApiName: string) => void;

export const useCalendarSourceReset = (): ResetFn => {
  const queryClient = useQueryClient();

  const resetFn = useCallback<ResetFn>(
    (pluginApiName, sourceApiName) => {
      queryClient.removeQueries({
        queryKey: QUERY_KEYS.CALENDAR_SOURCE_CALENDAR_LIST(pluginApiName, sourceApiName),
        exact: true,
      });
    },
    [queryClient],
  );

  return resetFn;
};

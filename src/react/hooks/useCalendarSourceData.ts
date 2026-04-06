import { useQueries } from '@tanstack/react-query';
import type {
  CalendarDefinition,
  CalendarScriptReturnData,
  CalendarSourceConfig,
  CalendarSourceMap,
  CalendarSources,
  ExecuteCalendarSourceScript,
  SchemaValidation,
} from '../../types/artifacts/calendar.js';
import type { AppPlugins, MaybeMessageError, UnknownJSON } from '../../types/common.js';
import { useCalendarSourceCustomScript } from './useCalendarSourceCustomScript.js';
import { useMemo } from 'react';
import { QUERY_KEYS } from '../../communication/constants.js';
import { formatInTimeZone } from 'date-fns-tz';
import { startOfDay, endOfDay } from 'date-fns';
import { useToast } from '../context/toast.js';

const executeCalendarSourceScript = async (
  script: string,
  plugin: CalendarSourceConfig,
  executeScript: ExecuteCalendarSourceScript,
  args?: UnknownJSON,
): Promise<CalendarScriptReturnData> => {
  const schema: SchemaValidation = {
    required: [
      {
        key: 'id',
        type: 'string',
      },
      {
        key: 'name',
        type: 'string',
      },
    ],
    optional: [
      {
        key: 'description',
        type: 'string',
      },
    ],
  };

  const { result, authError } = await executeScript(script, plugin, args, schema);

  if (Array.isArray(result)) {
    return { result, authError };
  } else {
    console.warn(`Expected calendar source script to return an array, but got:`, result);
    return { result: [], authError };
  }
};

const executeCalendarEventScript = async (
  script: string,
  plugin: CalendarSourceConfig,
  executeScript: ExecuteCalendarSourceScript,
  args?: Record<string, unknown>,
): Promise<CalendarScriptReturnData> => {
  const schema: SchemaValidation = {
    required: [
      {
        key: 'id',
        type: 'string',
      },
      {
        key: 'calendar_id',
        type: 'string',
      },
      {
        key: 'title',
        type: 'string',
      },
      {
        key: 'start_time',
        type: 'number',
      },
      {
        key: 'end_time',
        type: 'number',
      },
    ],
    optional: [
      {
        key: 'description',
        type: 'string',
      },
      {
        key: 'url',
        type: 'string',
      },
      {
        key: 'activity_id',
        type: 'string',
      },
      {
        key: 'all_day',
        type: 'boolean',
      },
      {
        key: 'busy',
        type: 'boolean',
      },
    ],
  };

  const { result, authError } = await executeScript(script, plugin, args, schema);

  if (Array.isArray(result)) {
    return { result, authError };
  } else {
    console.warn(`Expected calendar event script to return an array, but got:`, result);
    return { result: [], authError };
  }
};

export const useCalendarOptions = (
  enabled: boolean,
  calendarSources: CalendarSources,
  plugins: AppPlugins = {},
): {
  calendars: Record<string, { calendar: CalendarDefinition; source: CalendarSourceConfig }[]>;
  errorServices: (string | undefined)[];
  isLoading: boolean;
} => {
  const { showToast, clearToasts } = useToast();

  const [executeScript] = useCalendarSourceCustomScript({
    onError: (error) => {
      showToast({
        message: `Error fetching calendar options. ${(error as MaybeMessageError)?.message ?? ''}`,
        variant: 'failure',
      });
    },
    showToast,
    clearToasts,
  });

  const calendarsQueries = useQueries({
    queries: calendarSources.map((source) => {
      return {
        queryKey: QUERY_KEYS.CALENDAR_SOURCE_CALENDAR_LIST(source.plugin_api_name, source.api_name),
        queryFn: async () => {
          const config = (plugins[source.plugin_api_name]?.business_config ?? {}) as UnknownJSON;

          const { result, authError } = await executeCalendarSourceScript(
            source.calendars_script,
            source,
            executeScript,
            config,
          );

          return {
            source,
            calendars: result as CalendarDefinition[],
            authError,
          };
        },
        enabled: enabled && Boolean(source.calendars_script),
      };
    }),
  });

  const isLoading = calendarsQueries.some((q) => q.isLoading);

  const calendarOptionsByPluginApiName = useMemo(() => {
    if (isLoading || !enabled) {
      return {};
    }

    return calendarsQueries.reduce(
      (
        acc: Record<string, { calendar: CalendarDefinition; source: CalendarSourceConfig }[]>,
        curr,
      ) => {
        if (
          !curr.data?.source.plugin_api_name ||
          typeof curr.data.source.plugin_api_name !== 'string'
        ) {
          return acc;
        }

        const pluginApiName = curr.data.source.plugin_api_name;
        acc[pluginApiName] ??= [];

        acc[pluginApiName].push(
          ...curr.data.calendars.map((c) => ({
            calendar: c,
            source: curr.data.source,
          })),
        );

        return acc;
      },
      {},
    );
  }, [calendarsQueries, isLoading, enabled]);

  const servicesWithErrors = useMemo(() => {
    return calendarsQueries
      .filter((q) => q.data?.authError)
      .map((q) => q.data?.source.plugin_api_name);
  }, [calendarsQueries]);

  return {
    calendars: calendarOptionsByPluginApiName,
    errorServices: servicesWithErrors,
    isLoading,
  };
};

const formatString = "yyyy-MM-dd'T'HH:mm:ssXXX";

const createDate = (dateString: string): Date => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    throw new Error(`Invalid date string: ${dateString}. Expected format: YYYY-MM-DD`);
  }

  const [year, month, day] = dateString.split('-').map(Number);

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return new Date(year!, month! - 1, day);
};

const getTzDateString = (date: Date, timeZone: string): string => {
  return formatInTimeZone(date, timeZone, formatString);
};

export const useCalendarEvents = (
  flatCalendars: {
    calendar: CalendarDefinition;
    source: CalendarSourceConfig;
  }[],
  params: {
    rangeStart: string;
    rangeEnd: string;
  },
  plugins: AppPlugins = {},
): {
  events: unknown;
  sources: CalendarSourceMap;
  isLoading: boolean;
} => {
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const rangeStartFilter = getTzDateString(startOfDay(createDate(params.rangeStart)), userTimezone);
  const rangeEndFilter = getTzDateString(endOfDay(createDate(params.rangeEnd)), userTimezone);

  const { showToast, clearToasts } = useToast();

  const [executeScript] = useCalendarSourceCustomScript({
    onError: (error) => {
      showToast({
        message: `Error fetching calendar events. ${(error as MaybeMessageError)?.message ?? ''}`,
        variant: 'failure',
      });
    },
    showToast,
    clearToasts,
  });

  const eventsQueries = useQueries({
    queries: flatCalendars.map(({ calendar, source }) => {
      return {
        queryKey: QUERY_KEYS.CALENDAR_SOURCE_EVENTS(
          source.plugin_api_name,
          source.api_name,
          calendar.id,
          params,
        ),
        queryFn: async () => {
          const config = plugins[source.plugin_api_name]?.business_config ?? {};

          const { result, authError } = await executeCalendarEventScript(
            source.events_script,
            source,
            executeScript,
            {
              ...config,
              calendar: {
                calendar_id: calendar.id,
                range_start: rangeStartFilter,
                range_end: rangeEndFilter,
              },
            },
          );

          return {
            calendarId: calendar.id,
            events: result,
            authError,
          };
        },
      };
    }),
  });

  const isEventsLoading = eventsQueries.some((q) => q.isLoading);

  const sourcesByCalendarId = useMemo(() => {
    return flatCalendars.reduce((acc: CalendarSourceMap, { calendar, source }) => {
      acc[calendar.id] = { source, calendar };
      return acc;
    }, {});
  }, [flatCalendars]);

  const eventsByCalendarId = useMemo(() => {
    if (isEventsLoading) {
      return {};
    }

    return eventsQueries.reduce((acc: Record<string, unknown[]>, curr) => {
      if (!curr.data?.calendarId) {
        return acc;
      }

      acc[curr.data.calendarId] = curr.data.events as unknown[];

      return acc;
    }, {});
  }, [eventsQueries, isEventsLoading]);

  return {
    events: eventsByCalendarId,
    sources: sourcesByCalendarId,
    isLoading: isEventsLoading,
  };
};

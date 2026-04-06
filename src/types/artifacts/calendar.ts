import type { CommonPluginDefinition } from '../run.js';

export interface CalendarDefinition {
  id: string;
  name: string;
  description?: string;
  default?: boolean;
}

export interface CalendarSourceConfig extends CommonPluginDefinition {
  calendars_script: string;
  events_script: string;
  name: string;
  when?: string;
}

export type CalendarSources = CalendarSourceConfig[];

export interface SchemaValidation {
  required: { key: string; type: string }[];
  optional: { key: string; type: string }[];
}

export interface CalendarScriptReturnData<T = unknown> {
  authError?: unknown;
  result: T;
}

export type ExecuteCalendarSourceScript = (
  script: string,
  plugin: CalendarSourceConfig,
  args?: Record<string, unknown>,
  schema?: SchemaValidation,
) => Promise<CalendarScriptReturnData>;

export type CalendarSourceMap = Record<
  string,
  { source: CalendarSourceConfig; calendar: CalendarDefinition }
>;

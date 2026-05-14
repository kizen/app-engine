export const ACTIONS = {
  QUERY_REQUEST: 'query:request',
  UI_OUTPUT: 'outputui',
  IFRAME_OUTPUT: 'iframeoutput',
  POSTFORMDATA_REQUEST: 'postformdata:request',
  SETSTATE: 'setstate',
  DONE: 'done',
  RUN: 'run',
  OPEN_WINDOW: 'openwindow',
  COMMUNICATE: 'communicate',
  HIDE: 'hide',
  SHOW: 'show',
  EXPAND: 'expand',
  COLLAPSE: 'collapse',
  HIDE_HEADER: 'hideheader',
  SHOW_HEADER: 'showheader',
  OPEN_CREATE_RECORD_MODAL_REQUEST: 'opencreaterecordmodal:request',
  OPEN_CREATE_RELATED_RECORD_MODAL_REQUEST: 'opencreaterelatedrecordmodal:request',
  SHOW_TOAST: 'showtoast',
  CLEAR_TOASTS: 'cleartoasts',
  REFRESH_TIMELINE: 'refreshtimeline',
  REFRESH_ENTITY: 'refreshentity',
  UPLOADFILE_REQUEST: 'uploadfile:request',
  UPDATE_SESSION_DATA: 'updatesessiondata',
  INSTALL_THIRD_PARTY_SCRIPT_REQUEST: 'installthirdpartyscript:request',
  PROMPT_REQUEST: 'prompt:request',
  // Note: We have a special request for dynamic prompts, but the regular response is sufficient
  // and no special dynamic one is needed
  DYNAMIC_PROMPT_REQUEST: 'dynamicprompt:request',
  RELEASE_BLOCKING_SCRIPT: 'releaseblockingscript',
  AUTHORIZE: 'authorize',
  COPY_TO_CLIPBOARD: 'copytoclipboard',
  SHOW_VIEW_IN_MODAL_REQUEST: 'showviewinmodal:request',
};

export const RESPONSES = {
  QUERY_RESPONSE: 'query:response',
  POSTFORMDATA_RESPONSE: 'postformdata:response',
  ERROR: 'error',
  UPLOADFILE_RESPONSE: 'uploadfile:response',
  UPLOADFILE_PROGRESS: 'uploadfile:progress',
  INSTALL_THIRD_PARTY_SCRIPT_RESPONSE: 'installthirdpartyscript:response',
  PROMPT_RESPONSE: 'prompt:response',
  REFRESH_ENTITY_RESPONSE: 'refreshentity:response',
  CREATE_RECORD_RESPONSE: 'createrecord:response',
  CREATE_RELATED_RECORD_RESPONSE: 'createrelatedrecord:response',
};

export const COMMUNICATIONS = {
  RUN_FRAME_SCRIPT: 'runframescript',
  SEND_MESSAGE_TO_FRAME: 'sendmessagetoframe',
  CALL_THIRD_PARTY_SCRIPT: 'callthirdpartyscript',
};

export enum INDICATOR_TYPE {
  NONE = 'none',
  BLOCK = 'block',
  BUTTON = 'button',
  SPINNER = 'spinner',
}

export const ROUTE_CHANGE_INTERNAL_EVENT = 'integration:route-change';
export const ROUTE_CHANGE_IFRAME_EVENT = 'kizen-route-change';
export const IFRAME_PREFIX = 'kzn-integration-frame';

const PKG_VERSION = __PKG_VERSION__;

const BASE_QUERY_KEY = ['__plugin_engine', PKG_VERSION] as const;

export const QUERY_KEYS = {
  CALENDAR_SOURCE_CALENDAR_LIST: (pluginApiName: string, sourceApiName: string) =>
    [...BASE_QUERY_KEY, 'calendar-source', 'calendar-list', pluginApiName, sourceApiName] as const,
  CALENDAR_SOURCE_EVENTS: (
    pluginApiName: string,
    sourceApiName: string,
    calendarId: string,
    params: unknown,
  ) =>
    [
      ...BASE_QUERY_KEY,
      'calendar-source',
      'events',
      pluginApiName,
      sourceApiName,
      calendarId,
      params,
    ] as const,
};

import {
  runExpression,
  type AutomationStepConfig,
  type CalendarSourceConfig,
  type FloatingFrameConfig,
  type ToolbarItemConfig,
} from '../index.js';
import type { DataAdornmentConfig } from '../types/artifacts/dataAdornment.js';
import type { RoutablePageConfig } from '../types/artifacts/routablePage.js';
import type { RouteScriptConfig } from '../types/artifacts/routeScript.js';
import type { AppPlugin, UnknownJSON } from '../types/common.js';
import type { IncludeOption, SetupAssistantField } from '../types/modals.js';
import { getAllNestedInputsFromConfig } from '../workers/util.js';
import { buildIframeURLWithProxy, type BuildIframeURLWithProxyOptions } from './frames.js';
import { getPartialLocation } from './run.js';
import DOMPurify, { type RemovedAttribute, type RemovedElement } from 'dompurify';

type AllowedConfig =
  | FloatingFrameConfig
  | RoutablePageConfig
  | DataAdornmentConfig
  | ToolbarItemConfig
  | RouteScriptConfig
  | CalendarSourceConfig
  | AutomationStepConfig;

export const pluginMapper = <T extends AllowedConfig>(
  config: T,
  apiName: string,
  plugin: AppPlugin,
): T & {
  plugin_api_name: string;
  plugin_name: string;
  employee_config: unknown;
  args: unknown;
} => {
  return {
    ...config,
    plugin_api_name: apiName,
    plugin_name: plugin.name,
    employee_config: plugin.employee_config,
    args: plugin.business_config,
  };
};

export const getDisabledValue = (type?: string): false | undefined => {
  if (type === 'boolean') {
    return false;
  }

  return undefined;
};

export const mergeConfig = (
  cleanConfig: Record<string, UnknownJSON>,
  disabledFieldKeys: string[],
  rawConfig: Record<string, UnknownJSON>,
  setupAssistantFields?: SetupAssistantField[],
): Record<string, UnknownJSON> => {
  const keys = Object.keys(cleanConfig);
  const mergedConfig: Record<string, UnknownJSON> = {};

  keys.forEach((key) => {
    if (disabledFieldKeys.includes(key)) {
      mergedConfig[key] = {
        value: getDisabledValue(rawConfig[key]?.type as string),
        type: rawConfig[key]?.type,
      };
    } else {
      mergedConfig[key] = {
        value: cleanConfig[key],
        type: rawConfig[key]?.type,
      };
    }
  });

  const flattenedFields = getAllNestedInputsFromConfig({
    fields: setupAssistantFields ?? [],
  });

  flattenedFields.forEach((field) => {
    if (typeof mergedConfig[field.key] === 'undefined') {
      if (disabledFieldKeys.includes(field.key)) {
        mergedConfig[field.key] = {
          value: getDisabledValue(field.type),
          type: field.type,
        };
      } else {
        mergedConfig[field.key] = {
          value: field.default,
          type: field.type,
        };
      }
    }
  });

  return mergedConfig;
};

export const replaceConfigValues = (when?: string): string => {
  if (!when) {
    return '';
  }

  const replaced = when
    .replaceAll('{{config.', '{{config__')
    .replaceAll('{{userConfig.', '{{userConfig__');

  return replaced;
};

export const getEnabledState = async (
  when: string | undefined,
  state: Record<string, UnknownJSON>,
): Promise<boolean> => {
  const replaced = replaceConfigValues(when);

  const enabled = await runExpression(replaced, state);

  return enabled;
};

export const reduceEnabledResults = (
  results: { api_name?: string; enabled: boolean }[],
): Record<string, boolean> => {
  return results.reduce((acc, curr) => {
    if (!curr.api_name) {
      return acc;
    }

    return {
      ...acc,
      [curr.api_name]: curr.enabled,
    };
  }, {});
};

export const forceQualifiedUrl = (url: string): string => {
  let qualifiedUrl = url;

  if (/^(http|https|kizen|kizenvoice):\/\//.test(url)) {
    qualifiedUrl = url;
  } else if (url.startsWith('/')) {
    qualifiedUrl = `${getPartialLocation().origin}${qualifiedUrl}`;
  } else {
    qualifiedUrl = `${getPartialLocation().origin}/${qualifiedUrl}`;
  }

  return qualifiedUrl;
};

export type GetParamFunction = (key: IncludeOption) => string;

const getParams = (include?: IncludeOption[], getParam?: GetParamFunction): URLSearchParams => {
  const urlParams = new URLSearchParams();

  if (include) {
    include.forEach((field) => {
      if (field === 'base_url') {
        urlParams.append(field, getPartialLocation().origin);
      } else if (getParam) {
        urlParams.append(field, getParam(field));
      }
    });
  }

  return urlParams;
};

const appendParams = (url: string, urlParams: URLSearchParams): string => {
  const params = urlParams.toString();

  if (!params) {
    return url;
  }

  const hashIndex = url.indexOf('#');
  const pathAndQuery = hashIndex === -1 ? url : url.slice(0, hashIndex);
  const fragment = hashIndex === -1 ? '' : url.slice(hashIndex);

  return `${pathAndQuery}${pathAndQuery.includes('?') ? '&' : '?'}${params}${fragment}`;
};

export const getQrCodeValue = (
  value?: string,
  include?: IncludeOption[],
  getParam?: GetParamFunction,
): string => {
  const baseValue = value ?? '';

  // Force qualified on QR codes since these will generally be scanned by another device
  const qualifiedUrl = forceQualifiedUrl(baseValue);

  const params = getParams(include, getParam);

  const result = appendParams(qualifiedUrl, params);

  return result;
};

export const getLinkValue = (
  value?: string,
  include?: IncludeOption[],
  getParam?: GetParamFunction,
): string => {
  const baseValue = value ?? '';

  // Don't force a qualified URL on links since these will generally be clicked on the same device,
  // so we should support relative

  const params = getParams(include, getParam);

  const result = appendParams(baseValue, params);

  return result;
};

export type RemovedHTML = RemovedAttribute | RemovedElement;

export const getPluginSafeHTML = (
  html?: string,
  pluginApiName?: string,
  options?: BuildIframeURLWithProxyOptions,
): { html: string; error: Error | null; removed: RemovedHTML[] } => {
  if (!html) {
    return { html: '', error: null, removed: [] };
  }

  try {
    // Create a new DOMPurify instance so we can add hooks
    // without polluting other/subsequent calls
    const purify = DOMPurify();

    purify.addHook('uponSanitizeElement', (node, data) => {
      if (data.tagName === 'iframe') {
        const element = node as HTMLIFrameElement;
        const src = element.getAttribute('src') ?? '';

        const newUrl = buildIframeURLWithProxy(src, options);
        element.setAttribute('src', newUrl);
        element.setAttribute('name', pluginApiName ?? '');
      }
    });

    const cleanHtml = purify.sanitize(html, {
      ADD_TAGS: ['iframe'],
      ADD_ATTR: [
        'allow',
        'allowfullscreen',
        'frameborder',
        'scrolling',
        'src',
        'sandbox',
        'name',
        'loading',
        'width',
        'height',
        'title',
      ],
    });

    return { html: cleanHtml, error: null, removed: purify.removed as RemovedHTML[] };
  } catch (err) {
    return { html: '', error: err as Error, removed: [] };
  }
};

import type { CommonExecutionPlugin, CommonPluginDefinition } from '../run.js';

export interface GenericPluginConfig extends CommonPluginDefinition {
  api_name: string;
  callback?: string;
  css?: string;
  event_scripts?: Record<string, string>;
  html?: string;
  iframe_url?: string;
  name: string;
  script?: string;
  type: 'script' | 'iframe' | 'html';
  is_toolbar_item?: boolean;
  toolbar_icon?: string;
  toolbar_color?: string;
}

export type ExecuteGenericScript = (
  script: string,
  args?: Record<string, unknown>,
  executionPlugin?: CommonExecutionPlugin,
  overrideContext?: Record<string, unknown>,
) => Promise<unknown>;

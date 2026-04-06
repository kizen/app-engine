import type { CommonPluginDefinition } from '../run.js';

export interface ToolbarItemConfig extends CommonPluginDefinition {
  api_name: string;
  color?: string;
  icon?: string;
  label: string;
  script: string;
  when?: string;
}

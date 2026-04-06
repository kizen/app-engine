import type { CommonPluginDefinition } from '../run.js';

export interface ObjectSettingsMenuItemConfig extends CommonPluginDefinition {
  api_name: string;
  label: string;
  script: string;
  when?: string;
}

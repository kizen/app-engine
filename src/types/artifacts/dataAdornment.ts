import type { CommonPluginDefinition } from '../run.js';

export interface DataAdornmentConfig extends CommonPluginDefinition {
  id?: string;
  field_type: 'phonenumber' | 'date' | 'datetime';
  script: string;
  config: {
    icon: string;
    color: string;
    tooltip: string;
    customIcon?: string;
  };
  when?: string;
  plugin_name?: string;
}

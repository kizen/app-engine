import type { CommonPluginDefinition } from '../run.js';

export interface RouteScriptConfig extends CommonPluginDefinition {
  id: string;
  api_name: string;
  blocking: boolean;
  name: string;
  routes?: string[];
  script: string;
  custom_object: {
    id: string;
    name: string;
    object_name: string;
  };
}

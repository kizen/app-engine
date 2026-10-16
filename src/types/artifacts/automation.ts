export interface AutomationStepConfig<T = unknown> {
  name: string;
  agenticDescription: string;
  actions: Record<string, T>;
  thumbnail?: string;
  when?: string;
  action_step_api_name?: string;
  plugin_api_name?: string;
}

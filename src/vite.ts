export interface PluginEngineVitePlugin {
  name: string;
  config: () => { optimizeDeps: { exclude: string[] } };
}

export function pluginEngine(): PluginEngineVitePlugin {
  return {
    name: '@kizenapps/plugin-engine',
    config() {
      return {
        optimizeDeps: {
          exclude: ['@kizenapps/plugin-engine'],
        },
      };
    },
  };
}

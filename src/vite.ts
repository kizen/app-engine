export interface PluginEngineVitePlugin {
  name: string;
  config: () => { optimizeDeps: { exclude: string[] } };
}

export function pluginEngine(): PluginEngineVitePlugin {
  return {
    name: '@kizenapps/engine',
    config() {
      return {
        optimizeDeps: {
          exclude: ['@kizenapps/engine'],
        },
      };
    },
  };
}

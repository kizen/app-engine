export interface PluginEngineVitePlugin {
  name: string;
  config: () => { optimizeDeps: { exclude: string[] } };
}

export function pluginEngine(): PluginEngineVitePlugin {
  return {
    name: '@growwithkizen/plugin-engine',
    config() {
      return {
        optimizeDeps: {
          exclude: ['@growwithkizen/plugin-engine'],
        },
      };
    },
  };
}

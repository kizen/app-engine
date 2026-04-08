export interface AppEngineVitePlugin {
  name: string;
  config: () => { optimizeDeps: { exclude: string[] } };
}

export function appEnginePlugin(): AppEngineVitePlugin {
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

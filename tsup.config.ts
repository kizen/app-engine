import { createRequire } from 'module';
import { defineConfig } from 'tsup';

const require = createRequire(import.meta.url);
const { version } = require('./package.json') as { version: string };

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    types: 'src/types/index.ts',
    communication: 'src/communication/index.ts',
    'contexts/base': 'src/contexts/BaseWorkerContext.ts',
    'contexts/floatingFrame': 'src/contexts/FloatingFrameWorkerContext.ts',
    'contexts/recordDetail': 'src/contexts/RecordDetailWorkerContext.ts',
    'workers/expression.worker': 'src/workers/expression.worker.ts',
    'workers/calendarSource.worker': 'src/workers/calendarSource.worker.ts',
    'workers/floatingFrame.worker': 'src/workers/floatingFrame.worker.ts',
    'workers/generic.worker': 'src/workers/generic.worker.ts',
    'workers/recordDetail.worker': 'src/workers/recordDetail.worker.ts',
    react: 'src/react/index.ts',
    util: 'src/util/index.ts',
    vite: 'src/vite.ts',
  },
  format: ['esm'],
  target: 'es2022',
  platform: 'browser',
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: true,
  bundle: true,
  minify: false,
  outDir: 'dist',
  esbuildOptions(options) {
    options.conditions = ['import', 'browser'];
    options.define = {
      ...options.define,
      __PKG_VERSION__: JSON.stringify(version),
      __LOCAL_PROXY_ORIGIN__: JSON.stringify(process.env.KIZEN_LOCAL_PROXY_ORIGIN ?? ''),
    };
  },
});

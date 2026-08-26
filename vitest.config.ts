import { defineConfig } from 'vitest/config';

export default defineConfig({
  oxc: { target: 'es2022' },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
    clearMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/util/**', 'src/workers/util.ts', 'src/communication/ThirdPartyScript.ts'],
    },
  },
});

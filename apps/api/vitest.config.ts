import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    root: resolve(__dirname),
    globals: true,
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/db/schema.ts',
        'src/db/migrate.ts',
        'src/db/reset.ts',
        'src/index.ts',
        'src/test/**',
      ],
    },
    pool: 'forks',
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@/': resolve(__dirname, 'src/'),
    },
  },
});

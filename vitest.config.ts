import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['tests/unit/**/*.test.ts'],
  },
  resolve: {
    alias: {
      'redline-inspect': resolve(__dirname, 'src/index.ts'),
    },
  },
});

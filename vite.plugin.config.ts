import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'plugin/vite.ts'),
      formats: ['es', 'cjs'],
      fileName: (format) => (format === 'es' ? 'vite.js' : 'vite.cjs'),
    },
    rollupOptions: {
      external: ['vite', 'node:path', 'node:fs', 'node:url', 'path', 'fs', 'url'],
    },
    minify: false,
    sourcemap: true,
    target: 'node18',
  },
});

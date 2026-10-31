import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: resolve(__dirname, 'demo'),
  publicDir: resolve(__dirname, 'demo/assets'),
  server: {
    port: 5173,
    open: false,
    fs: {
      // Allow resolving aliased package sources outside demo/
      allow: [resolve(__dirname)],
    },
  },
  build: {
    outDir: resolve(__dirname, 'demo-dist'),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      'redline-inspect': resolve(__dirname, 'src/index.ts'),
    },
  },
});

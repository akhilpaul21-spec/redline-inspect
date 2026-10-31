import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const shared = {
  minify: 'esbuild' as const,
  sourcemap: true,
  target: 'es2020',
};

export default defineConfig(({ mode }) => {
  // mode: esm | cjs | iife via --mode
  const buildMode = mode === 'cjs' || mode === 'iife' ? mode : 'esm';

  if (buildMode === 'iife') {
    return {
      build: {
        ...shared,
        emptyOutDir: false,
        lib: {
          entry: resolve(__dirname, 'src/auto.ts'),
          name: 'Redline',
          formats: ['iife'],
          fileName: () => 'redline.iife.js',
        },
        rollupOptions: {
          external: [],
          output: {
            inlineDynamicImports: true,
            // JSZip stays dynamic; leave as runtime import string for CDN fallback path
          },
        },
      },
    };
  }

  if (buildMode === 'cjs') {
    return {
      build: {
        ...shared,
        emptyOutDir: false,
        lib: {
          entry: resolve(__dirname, 'src/index.ts'),
          formats: ['cjs'],
          fileName: () => 'redline.cjs',
        },
        rollupOptions: {
          external: ['jszip'],
          output: { exports: 'named' },
        },
      },
    };
  }

  return {
    build: {
      ...shared,
      emptyOutDir: true,
      lib: {
        entry: resolve(__dirname, 'src/index.ts'),
        formats: ['es'],
        fileName: () => 'redline.esm.js',
      },
      rollupOptions: {
        external: ['jszip'],
      },
    },
  };
});

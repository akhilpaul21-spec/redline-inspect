import { defineConfig, type Plugin } from 'vite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Cookie-gated same-origin asset for export credentials e2e (not publicDir). */
function authedAssetPlugin(): Plugin {
  const file = resolve(__dirname, 'demo/private-assets/authed-hero.png');
  return {
    name: 'redline-authed-asset',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0] || '';
        if (url !== '/authed-hero.png') return next();
        const cookie = req.headers.cookie || '';
        if (!cookie.includes('session=ok')) {
          res.statusCode = 401;
          res.setHeader('content-type', 'text/html; charset=utf-8');
          res.end('<!doctype html><html><body>login</body></html>');
          return;
        }
        const body = readFileSync(file);
        res.statusCode = 200;
        res.setHeader('content-type', 'image/png');
        res.setHeader('cache-control', 'no-store');
        res.end(body);
      });
    },
  };
}

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
  plugins: [authedAssetPlugin()],
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

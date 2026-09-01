import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      build: {
        // Must cover the oldest API actually used at runtime (esbuild only
        // transpiles syntax, it doesn't polyfill APIs): crypto.randomUUID()
        // needs Chrome 92 / Safari 15.4, Object.hasOwn needs Chrome 93 /
        // Safari 15.4. Capacitor 8's supported WebView floor is newer still.
        target: ['chrome93', 'safari15'],
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});

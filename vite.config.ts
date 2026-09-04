import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const isProd = process.env.NODE_ENV === 'production';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-dom/client'],
    exclude: ['lucide-react'],
  },
  build: {
    sourcemap: !isProd,
    minify: isProd ? 'terser' : 'esbuild',
    terserOptions: isProd
      ? {
          ecma: 2020,
          compress: {
            passes: 2,
            drop_console: false,
            drop_debugger: true,
            pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn'],
          },
          mangle: {
            safari10: true,
          },
          format: {
            comments: false,
            ascii_only: true,
          },
        }
      : undefined,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
});

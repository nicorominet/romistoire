/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  server: {
    port: 8885,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true
      }
    }
  },
  plugins: [
    react(),
    tailwindcss()
  ],
  define: {
    'process.env': {},
    '__APP_VERSION__': JSON.stringify(process.env.npm_package_version)
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      // Modules shared with the server (shared/*.js, typed by shared/*.d.ts)
      '@shared': path.resolve(import.meta.dirname, './shared')
    }
  },
  build: {
    rollupOptions: {
      external: [
        'mysql2'
      ]
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    css: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}']
  }
});
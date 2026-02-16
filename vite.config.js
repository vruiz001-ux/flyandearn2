import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  base: '/',

  build: {
    outDir: 'dist',
    emptyDirBeforeWrite: true,

    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        // Manual chunks for code splitting
        manualChunks(id) {
          // Core modules - loaded immediately
          if (id.includes('src/core/')) {
            return 'core';
          }
          // Navigation - loaded immediately
          if (id.includes('src/nav.js')) {
            return 'nav';
          }
          // i18n core (small) - loaded immediately
          if (id.includes('src/i18n/index.js')) {
            return 'i18n-core';
          }
          // i18n translations (large) - lazy loaded
          if (id.includes('src/i18n/translations.js')) {
            return 'i18n-translations';
          }
          // Data modules - lazy loaded
          if (id.includes('src/data/airports.js')) {
            return 'data-airports';
          }
          if (id.includes('src/data/currencies.js')) {
            return 'data-currencies';
          }
          // Feature modules - lazy loaded
          if (id.includes('src/features/')) {
            return 'features';
          }
        },
        // Asset naming with hashes for cache busting
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },

    // Minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // Keep console for debugging
        drop_debugger: true,
      },
    },

    // Source maps for debugging
    sourcemap: false,

    // Target modern browsers
    target: 'es2020',

    // Copy static assets
    copyPublicDir: true,
  },

  // Public directory for static assets
  publicDir: false, // We'll handle copying manually

  // Dev server
  server: {
    port: 3000,
    open: true,
  },

  // Preview server
  preview: {
    port: 4173,
  },

  // Resolve aliases
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@core': resolve(__dirname, 'src/core'),
      '@data': resolve(__dirname, 'src/data'),
      '@features': resolve(__dirname, 'src/features'),
      '@i18n': resolve(__dirname, 'src/i18n'),
    },
  },
});

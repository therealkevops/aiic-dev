import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { serviceWorker } from './build/serviceWorker.js';

export default defineConfig({
  // Relative asset paths, so the build works from any folder or sub-path.
  base: './',
  plugins: [react(), serviceWorker()],
  build: {
    rollupOptions: {
      output: {
        // React changes far less often than the app, so it gets its own long-cached file.
        manualChunks: { react: ['react', 'react-dom'] },
      },
    },
  },
  server: {
    port: 8999,
    host: '0.0.0.0',
    strictPort: true
  }
});

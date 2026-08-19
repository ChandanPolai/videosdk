import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3002,
    open: true,
    proxy: {
      '/videosdk-api': {
        target: 'https://api.videosdk.live',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/videosdk-api/, '')
      },
      '/agent-api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/agent-api/, '')
      }
    }
  },
  preview: {
    port: 3002,
    proxy: {
      '/videosdk-api': {
        target: 'https://api.videosdk.live',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/videosdk-api/, '')
      }
    }
  }
});

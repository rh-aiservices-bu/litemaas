import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 3000,
    allowedHosts: ['host.containers.internal'],
    proxy: {
      '/api/': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
    },
  },
});

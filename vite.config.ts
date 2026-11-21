import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/ksponco-goldentime/',
  server: {
    port: 5178,
  },
  preview: {
    port: 4178,
  },
});

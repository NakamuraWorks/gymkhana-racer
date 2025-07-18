import { defineConfig } from 'vite';

export default defineConfig({
  base: '/gymkhana-racer/',
  server: {
    port: 5173,
    open: true,
  },
  optimizeDeps: {
    include: ['phaser'],
  },
});

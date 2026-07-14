import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    isolate: true, // テストファイルごとにグローバル state を隔離
  },
});
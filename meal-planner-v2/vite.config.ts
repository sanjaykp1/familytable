import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    exclude: ['companion/**', '**/node_modules/**', '**/dist/**'],
    coverage: {
      reporter: ['text', 'html'],
    },
  },
});

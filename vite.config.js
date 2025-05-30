import { defineConfig } from 'vite';

export default defineConfig({
  optimizeDeps: {
    include: ['jquery']
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/]
    }
  }
});
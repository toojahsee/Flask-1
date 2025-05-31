import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.', 
  build: {
    outDir: 'scr_dist', 
    emptyOutDir: true,
    assetsDir: 'assets', 
    rollupOptions: {
      input: {
        // 只打包 JS 入口文件，比如 script.js
        game: resolve(__dirname, 'static/script.js')
      },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    }
  }
});
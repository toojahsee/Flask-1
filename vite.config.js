import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.', // 项目根目录
  build: {
    outDir: 'scr_dist',       // 打包输出目录
    emptyOutDir: true,        // 构建前清空输出目录
    assetsDir: 'assets',      // 静态资源目录
    rollupOptions: {
      input: {
        game: resolve(__dirname, 'static/js/game.js'),
        room: resolve(__dirname, 'static/js/room.js'),
        game_ai: resolve(__dirname, 'static/js/game_ai.js'),
        game_common: resolve(__dirname, 'static/js/game_common.js'),
      },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',       // 入口文件名格式
        chunkFileNames: 'assets/[name]-[hash].js',       // 代码块名格式
        assetFileNames: 'assets/[name]-[hash][extname]'  // 资源文件名格式
      }
    }
  }
});
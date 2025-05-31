import { defineConfig } from 'vite';

export default defineConfig({
  root: 'scr', // 你的前端源码根目录
  build: {
    outDir: 'dist', // 改成 scr/dist，避免覆盖 public_static
    emptyOutDir: true
  }
});
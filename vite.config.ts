import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { fileURLToPath, URL } from 'node:url'

// base 用相对路径，保证 GitHub Pages 子路径 / 本地 file:// 都能打开
export default defineConfig(({ mode }) => ({
  base: './',
  // 固定端口：本机同时在调试多个项目，避免占用 5173 等默认端口
  server: { port: 5188, strictPort: true },
  preview: { port: 5188, strictPort: true },
  plugins: [vue(), ...(mode === 'single' ? [viteSingleFile()] : [])],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2020',
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    chunkSizeWarningLimit: 8000,
    rollupOptions:
      mode === 'single'
        ? {}
        : {
            output: {
              manualChunks(id) {
                if (id.includes('plotly.js-dist-min')) return 'plotly'
                return undefined
              },
            },
          },
  },
}))

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      // 开发期直连源码，改包代码即时热更
      '@3d-editor/editor': resolve(__dirname, '../../packages/editor/src')
    }
  },
  server: {
    host: true, // 监听 0.0.0.0，可用局域网 IP 访问
    port: 5175,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true
      },
      '/models': {
        target: 'http://localhost:8787',
        changeOrigin: true
      }
    }
  }
})

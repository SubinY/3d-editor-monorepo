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
    port: 5175
  }
})

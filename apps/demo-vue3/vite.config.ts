import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@3d-editor/engine': resolve(__dirname, '../../packages/engine/src'),
      '@3d-editor/extensions': resolve(__dirname, '../../packages/extensions/src'),
      '@3d-editor/presets': resolve(__dirname, '../../packages/presets/src')
    }
  },
  server: {
    port: 5173
  }
})

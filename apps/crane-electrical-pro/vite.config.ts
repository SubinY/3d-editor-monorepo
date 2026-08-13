import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue(), UnoCSS()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@mh/3d-editor': resolve(__dirname, '../../packages/3d-editor/src'),
      '@mh/3d-editor-assets/common': resolve(
        __dirname,
        '../../packages/3d-editor-assets/src/common/index.ts'
      ),
      '@mh/3d-editor-assets': resolve(__dirname, '../../packages/3d-editor-assets/src')
    }
  },
  server: {
    host: true,
    port: 5176
  }
})

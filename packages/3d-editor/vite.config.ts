import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'ThreeEditorSDK',
      formats: ['es', 'cjs'],
      fileName: format => `index.${format === 'es' ? 'js' : 'cjs'}`
    },
    rollupOptions: {
      external: ['three', /^three\//],
      output: {
        globals: {
          three: 'THREE'
        }
      }
    },
    sourcemap: true,
    minify: false
  }
})

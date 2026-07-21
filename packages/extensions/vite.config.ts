import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'ThreeEditorExtensions',
      formats: ['es', 'cjs'],
      fileName: format => `index.${format === 'es' ? 'js' : 'cjs'}`
    },
    rollupOptions: {
      external: ['@3d-editor/engine', 'three'],
      output: {
        globals: {
          '@3d-editor/engine': 'ThreeEditorEngine',
          'three': 'THREE'
        }
      }
    },
    sourcemap: true,
    minify: false
  }
})

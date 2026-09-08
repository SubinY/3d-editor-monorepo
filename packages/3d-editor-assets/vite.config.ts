import { defineConfig } from 'vite'
import { resolve } from 'path'

/** preserveModules：common/index 只再导出命名空间，Host 未引用的模型不会打进包 */
export default defineConfig({
  assetsInclude: ['**/*.glb'],
  build: {
    lib: {
      entry: [
        resolve(__dirname, 'src/index.ts'),
        resolve(__dirname, 'src/common/index.ts')
      ],
      formats: ['es']
    },
    assetsInlineLimit: 0,
    rollupOptions: {
      external: ['three', /^three\//, '@mh/3d-editor'],
      output: {
        preserveModules: true,
        preserveModulesRoot: 'src',
        entryFileNames: '[name].js',
        assetFileNames: 'assets/[name][extname]',
        dir: 'dist'
      }
    },
    sourcemap: true,
    minify: false
  }
})

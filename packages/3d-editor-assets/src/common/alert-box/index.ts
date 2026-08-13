/**
 * 电子围栏 procedural（`import { alertBox } from '@mh/3d-editor-assets/common'`）
 *
 * 空心方框立面；下浓上淡 + 扫描流光动效（onBeforeRender 推 uTime，不依赖 editor）。
 */
export type { AlertBoxContentJSON, AlertBoxHandle } from './types'
export { PROCEDURAL_ID } from './types'
export { createDefaultContent, cloneContent, isContent } from './content'
export { createModel, applyToObject } from './model'
export { catalogItem, resolve } from './catalog'

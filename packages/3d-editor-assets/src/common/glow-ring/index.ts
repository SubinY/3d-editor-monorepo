/**
 * 贴地场景光圈 procedural（`import { glowRing } from '@mh/3d-editor-assets/common'`）
 *
 * 仅 XZ 平面，无立面高度；白→青圆周渐变 + Additive 发光。
 */
export type { GlowRingContentJSON, GlowRingHandle } from './types'
export { PROCEDURAL_ID } from './types'
export { createDefaultContent, cloneContent, isContent } from './content'
export { createModel, applyToObject } from './model'
export { catalogItem, resolve } from './catalog'

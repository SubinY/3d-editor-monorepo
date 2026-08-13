/**
 * 信息面板 procedural（`import { panel } from '@mh/3d-editor-assets/common'`）
 *
 * | 文件 | 内容 |
 * |------|------|
 * | types | 类型 / PROCEDURAL_ID |
 * | content | 默认布局、isContent（clone/id 走 shared） |
 * | bake | Canvas 烘焙 |
 * | model | createModel / applyToObject |
 * | catalog | catalogItem / resolve |
 *
 * 跨模型公共能力见 `src/utils/`（deepClone / nextId / loadImage）
 */
export type {
  PanelContentJSON,
  PanelElement,
  PanelElementType,
  PanelTextElement,
  PanelImageElement,
  PanelHandle
} from './types'
export { PROCEDURAL_ID } from './types'
export {
  createDefaultContent,
  cloneContent,
  isContent,
  nextElementId
} from './content'
export { bakeToCanvas } from './bake'
export { createModel, applyToObject } from './model'
export { catalogItem, resolve } from './catalog'

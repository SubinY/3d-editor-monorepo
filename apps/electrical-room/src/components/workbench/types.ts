/** 图层树节点：document 真节点可编辑；catalog 嵌套投影仅展示 */
export interface LayerTreeItem {
  /** 树节点唯一 key（嵌套投影用 parentId/childId） */
  id: string
  /** 点击后写入 selection 的 id（投影子节点指向父节点） */
  selectId: string
  name: string
  displayId: string
  visible: boolean
  /** false = catalog document 投影，不可单独显隐/变换 */
  editable: boolean
  children?: LayerTreeItem[]
}

import type { CatalogItem } from '@3d-editor/editor'

export interface AssetGroup {
  key: string
  label: string
  items: CatalogItem[]
}

export type EditorTool = 'select' | 'wall'
export type ViewMode = '2d' | '3d' | 'split'

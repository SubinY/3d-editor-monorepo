/**
 * EditorDocumentJSON —— 跨团队存盘与交换的主格式（schema 合同）。
 * 与行业无关：只描述「边界 + 线段墙 + 节点引用与变换」。
 */

export const SCHEMA_VERSION = '1.0.0'

export type DocumentKind = 'scene' | 'container'

export interface BoundsJSON {
  width: number
  depth: number
  /** container 常用（柜内净高）；scene 可选净高 */
  height?: number
}

/** 线段墙（定稿 D4）：矩形房间 = 四段墙的快捷创建 */
export interface WallJSON {
  id: string
  /** 俯视 XZ 起点 */
  a: [number, number]
  /** 俯视 XZ 终点 */
  b: [number, number]
  height?: number
  thickness?: number
}

export interface TransformJSON {
  /**
   * 世界坐标：y 向上。
   * - scene 2D：主要改 x/z（俯视）
   * - container 2D：主要改 x/y（立面：宽×高；y=元件底边离地高度）
   */
  position: [number, number, number]
  /** euler (rad) */
  rotation: [number, number, number]
  scale: [number, number, number]
}

export interface CatalogRefJSON {
  id: string
  version: string
}

export interface EditorNodeJSON {
  id: string
  name?: string
  /** 外置资产引用（不 bake mesh 几何）；条目为 document 型时 3D 视图嵌套解析（D2） */
  catalogRef?: CatalogRefJSON
  transform: TransformJSON
  visible?: boolean
  children?: EditorNodeJSON[]
  /** 业务扩展字段，编辑器不解释 */
  props?: Record<string, unknown>
}

export interface EditorDocumentJSON {
  schemaVersion: string
  kind: DocumentKind
  id: string
  name: string
  /** 常量：当前仅米制 */
  unit: 'm'
  bounds: BoundsJSON
  structure?: {
    walls?: WallJSON[]
  }
  nodes: EditorNodeJSON[]
  /** 非契约扩展；编辑相机等工作区状态不入资产契约 */
  metadata?: Record<string, unknown>
}

/** 运行时可视状态（监控预览用），编辑器不定义业务告警协议 */
export interface VisualState {
  status: 'normal' | 'warning' | 'fault' | 'offline'
  /** 0-1，发光强度缩放 */
  intensity?: number
}

export function createDefaultTransform(): TransformJSON {
  return {
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1]
  }
}

export function cloneTransform(t: TransformJSON): TransformJSON {
  return {
    position: [...t.position],
    rotation: [...t.rotation],
    scale: [...t.scale]
  }
}

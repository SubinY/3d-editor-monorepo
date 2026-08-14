import type { DocumentKind, EditorDocumentJSON } from '../document/types'

/** 2D 占位 / 3D 包围（米） */
export interface FootprintSpec {
  width: number
  depth: number
  height?: number
}

/**
 * 3D 表现：
 * - gltf：外链模型（CDN 后期接入时只换 url 来源）
 * - primitive：内置几何（demo / 无资产环境可用）
 * - procedural：Host 注册工厂（id）和/或打包模块 url（ESM createModel）
 */
export type Model3DSpec =
  | { type: 'gltf'; url: string }
  | { type: 'primitive'; primitive: 'box'; size: [number, number, number]; color?: string }
  | { type: 'procedural'; id: string; url?: string }

/** Catalog 中的 procedural 引用（可 JSON 序列化） */
export interface ProceduralModelRef {
  id: string
}

/**
 * Host / Runtime 解析上下文。
 * `THREE` 为与视口同一份 three 命名空间，工厂勿再打包第二份。
 * `node` 为当前实例（可从 props 读 Host 扩展，如信息面板布局）。
 */
export interface ProceduralResolveContext {
  item: CatalogItem
  THREE: typeof import('three')
  node?: import('../document/types').EditorNodeJSON
}

/**
 * Host 注入：按 id 返回 Object3D（通常为 Group）。
 * 返回 null/undefined 时视口回退 footprint 盒子。
 */
export type ProceduralModelResolver = (
  ref: ProceduralModelRef,
  ctx: ProceduralResolveContext
) =>
  | import('three').Object3D
  | null
  | undefined
  | Promise<import('three').Object3D | null | undefined>

/**
 * 素材面板分组 / 交互语义（开放字符串）。
 * 内核约定：`fixture` 在 scene 2D 放置时触发贴墙吸附；其余由 Host 分组展示。
 */
export type CatalogCategory = string

/**
 * CatalogItem 两型（定稿 D2）：
 * - model 型：model3d 指向可直接渲染的模型
 * - document 型：document / documentUrl 指向一份 container JSON，3D 视图嵌套解析
 */
export interface CatalogItem {
  id: string
  version: string
  name: string
  /** 开放字符串，业务自定义分类（equipment/component/effect/...） */
  kind?: string
  /** 素材面板分组与交互语义（fixture 触发贴墙吸附） */
  category?: CatalogCategory
  tags?: string[]
  placeableIn: DocumentKind[]
  footprint: FootprintSpec
  /** 缩略：颜色值或图片 url，供 Host 左侧面板使用 */
  thumb?: string
  /** model 型 */
  model3d?: Model3DSpec
  /** document 型（内联） */
  document?: EditorDocumentJSON
  /** document 型（外链，实现按需 fetch） */
  documentUrl?: string
  /** document 型可选外壳（嵌套解析时半透明显示内部） */
  shell3d?: Model3DSpec
  /** 业务扩展，编辑器不解释 */
  metadata?: Record<string, unknown>
}

export interface CatalogQuery {
  placeableIn?: DocumentKind
  kind?: string
  category?: CatalogCategory
  tag?: string
  text?: string
}

export interface CatalogProvider {
  list(query?: CatalogQuery): Promise<CatalogItem[]>
  get(id: string, version?: string): Promise<CatalogItem | undefined>
}

export function catalogKey(id: string, version: string): string {
  return `${id}@${version}`
}

export function isDocumentItem(item: CatalogItem): boolean {
  return Boolean(item.document || item.documentUrl)
}

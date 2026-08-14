import type { CatalogProvider, ProceduralModelResolver } from '../catalog/types'
import type { CreateDocumentOptions, EditorDocument } from '../document/EditorDocument'
import type { EditorDocumentJSON } from '../document/types'
import type { NodeInteractionHandler } from '../viewport/interaction-events'
import type { Viewport2D } from '../viewport/canvas2d/Viewport2D'
import type { Viewport3D } from '../viewport/three/Viewport3D'

export type TransformMode = 'translate' | 'rotate' | 'scale'

export interface EditorInteractionOptions {
  /** 默认 true；懒吸附，不回扫已有节点 */
  snapEnabled?: boolean
  /** 默认 true；写入 document.collisionEnabled（若 modes 含 scale 则被强制 false） */
  collisionEnabled?: boolean
  /** 3D gizmo 允许的 mode；默认 ['translate']；含 scale 时互斥关碰撞 */
  transformModes?: TransformMode[]
}

export interface EditorInteractionState {
  snapEnabled: boolean
  /** 生效值（已写入 Document） */
  collisionEnabled: boolean
  /** 用户意图（无 scale 时与生效值一致） */
  collisionPreference: boolean
  transformModes: TransformMode[]
  transformMode: TransformMode
}

export interface CreateEditorOptions {
  catalog?: CatalogProvider
  /** 已有落库 JSON，或新建空文档选项 */
  document: EditorDocumentJSON | CreateDocumentOptions
  mount?: {
    canvas2d?: HTMLElement
    canvas3d?: HTMLElement
  }
  viewport3d?: {
    readonly?: boolean
    /** 3D 指针交互统一出口（click / dblclick / longpress / hover） */
    onInteraction?: NodeInteractionHandler
    /** 左下角性能 Info（物体/顶点/三角形/渲染时间）；默认 false */
    perfStats?: boolean
    /** 鼠标悬停描边；默认不显示 */
    hoverOutline?: boolean
  }
  /** 2D 视口展示选项（挂载时生效；运行时可再调 viewport2d.setShowNodeNames） */
  viewport2d?: {
    /** 是否绘制节点 name；默认 false */
    showNodeNames?: boolean
  }
  /**
   * Host 程序化模型：Catalog `model3d.type === 'procedural'` 时按 id 解析。
   * 按数组顺序调用，第一个返回非空 Object3D 的胜出；不匹配应返回 null/undefined。
   */
  procedural?: {
    resolvers: ProceduralModelResolver[]
  }
  /** 会话级交互：吸附 / 碰撞 / 3D gizmo mode */
  interaction?: EditorInteractionOptions
  onDenied?: (reason: string) => void
}

export interface EditorSession {
  readonly document: EditorDocument
  readonly viewport2d?: Viewport2D
  readonly viewport3d?: Viewport3D
  mountCanvas2d(el: HTMLElement): Viewport2D
  unmountCanvas2d(): void
  mountCanvas3d(el: HTMLElement): Viewport3D
  unmountCanvas3d(): void
  getInteraction(): EditorInteractionState
  setSnapEnabled(enabled: boolean): void
  setCollisionEnabled(enabled: boolean): void
  setTransformModes(modes: TransformMode[]): void
  setTransformMode(mode: TransformMode): void
  toJSON(): EditorDocumentJSON
  dispose(): void
}

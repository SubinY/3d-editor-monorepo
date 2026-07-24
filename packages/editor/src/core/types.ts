import type { CatalogProvider } from '../catalog/types'
import type { CreateDocumentOptions, EditorDocument } from '../document/EditorDocument'
import type { EditorDocumentJSON, EditorNodeJSON } from '../document/types'
import type { Viewport2D } from '../viewport/canvas2d/Viewport2D'
import type { Viewport3D } from '../viewport/three/Viewport3D'

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
    onNodeClick?: (nodePath: string, node: EditorNodeJSON | undefined) => void
  }
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
  toJSON(): EditorDocumentJSON
  dispose(): void
}

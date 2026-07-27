/** 3D 拾取写 selection，并同步 gizmo 附着 */
import type * as THREE from 'three'
import type { EditorDocument } from '../../../document/EditorDocument'
import type { EditorNodeJSON } from '../../../document/types'
import type { ThreeRuntime } from '../runtime/ThreeRuntime'
import { findNodePath } from '../utils/node-path'

export interface SelectionServiceOptions {
  doc: EditorDocument
  runtime: ThreeRuntime
  readonly: boolean
  nodeRoots: Map<string, THREE.Object3D>
  onNodeClick?: (nodePath: string, node: EditorNodeJSON | undefined) => void
}

/** 3D 点击拾取 → Document selection / Host 回调；selection → gizmo */
export class SelectionService {
  private pointerDownAt: { x: number; y: number } | null = null

  constructor(private opts: SelectionServiceOptions) {}

  syncGizmo(ids: string[]): void {
    if (this.opts.readonly) return
    const first = ids[0]
    const node = first ? this.opts.doc.getNode(first) : undefined
    // 隐藏节点不挂 gizmo，避免对不可见对象做变换
    if (!node || node.visible === false) {
      this.opts.runtime.attachTransform(null)
      return
    }
    const object = this.opts.nodeRoots.get(first)
    this.opts.runtime.attachTransform(object ?? null)
  }

  handlePointerDown = (event: PointerEvent): void => {
    if (this.opts.runtime.isCapturingPointer()) {
      this.pointerDownAt = null
      return
    }
    this.pointerDownAt = { x: event.clientX, y: event.clientY }
  }

  handlePointerUp = (event: PointerEvent): void => {
    if (this.opts.runtime.isCapturingPointer()) {
      this.pointerDownAt = null
      return
    }
    if (!this.pointerDownAt) return
    const moved = Math.hypot(event.clientX - this.pointerDownAt.x, event.clientY - this.pointerDownAt.y)
    this.pointerDownAt = null
    if (moved > 5) return
    if (event.button !== 0) return

    const { doc, runtime, readonly, nodeRoots, onNodeClick } = this.opts
    const pickables = Array.from(nodeRoots.values())
    const result = runtime.pick(event.clientX, event.clientY, pickables)
    if (!result.object) {
      if (!readonly) doc.selection.clear()
      return
    }
    const path = findNodePath(result.object)
    if (!path) return

    if (readonly) {
      onNodeClick?.(path, doc.getNode(path.split('/')[0]))
      return
    }
    const rootId = path.split('/')[0]
    doc.selection.set(rootId)
    onNodeClick?.(path, doc.getNode(rootId))
  }
}

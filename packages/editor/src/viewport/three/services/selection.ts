/** 3D 拾取写 selection，并同步 gizmo 附着；识别 click / dblclick / longpress */
import type * as THREE from 'three'
import type { EditorDocument } from '../../../document/EditorDocument'
import type { EditorNodeJSON } from '../../../document/types'
import type { NodeInteractionHandler } from '../../interaction-events'
import type { ThreeRuntime } from '../runtime/ThreeRuntime'
import { findNodePath } from '../utils/node-path'

const MOVE_THRESHOLD_PX = 5
const LONGPRESS_MS = 500
const DBLCLICK_MS = 300

export interface SelectionServiceOptions {
  doc: EditorDocument
  runtime: ThreeRuntime
  readonly: boolean
  nodeRoots: Map<string, THREE.Object3D>
  onInteraction?: NodeInteractionHandler
  /** @deprecated 请用 onInteraction；仍会作为 click 转发 */
  onNodeClick?: (nodePath: string, node: EditorNodeJSON | undefined) => void
}

/** 3D 点击拾取 → Document selection / Host 回调；selection → gizmo */
export class SelectionService {
  private pointerDownAt: { x: number; y: number; button: number } | null = null
  private longPressTimer: ReturnType<typeof setTimeout> | null = null
  private longPressFired = false
  private lastClick: { path: string; at: number } | null = null

  constructor(private opts: SelectionServiceOptions) {}

  dispose(): void {
    this.clearLongPressTimer()
  }

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
      this.clearLongPressTimer()
      return
    }
    if (event.button !== 0) return

    this.pointerDownAt = { x: event.clientX, y: event.clientY, button: event.button }
    this.longPressFired = false
    this.clearLongPressTimer()

    const down = this.pointerDownAt
    this.longPressTimer = setTimeout(() => {
      this.longPressTimer = null
      if (!this.pointerDownAt) return
      // 位移超阈时 pointermove 已清定时器；此处按 down 点拾取
      const pick = this.pickAt(down.x, down.y)
      if (!pick) return
      this.longPressFired = true
      this.applySelection(pick.path)
      this.emit('longpress', pick.path, event, down)
    }, LONGPRESS_MS)
  }

  handlePointerMove = (event: PointerEvent): void => {
    if (!this.pointerDownAt || this.longPressFired) return
    const moved = Math.hypot(event.clientX - this.pointerDownAt.x, event.clientY - this.pointerDownAt.y)
    if (moved > MOVE_THRESHOLD_PX) {
      this.clearLongPressTimer()
    }
  }

  handlePointerUp = (event: PointerEvent): void => {
    if (this.opts.runtime.isCapturingPointer()) {
      this.pointerDownAt = null
      this.clearLongPressTimer()
      return
    }
    if (!this.pointerDownAt) return
    const down = this.pointerDownAt
    this.pointerDownAt = null
    this.clearLongPressTimer()

    if (this.longPressFired) {
      this.longPressFired = false
      return
    }
    if (event.button !== 0) return
    const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y)
    if (moved > MOVE_THRESHOLD_PX) return

    const pick = this.pickAt(event.clientX, event.clientY)
    if (!pick) {
      if (!this.opts.readonly) this.opts.doc.selection.clear()
      this.lastClick = null
      return
    }

    this.applySelection(pick.path)

    const now = performance.now()
    const isDbl =
      this.lastClick !== null &&
      this.lastClick.path === pick.path &&
      now - this.lastClick.at < DBLCLICK_MS

    if (isDbl) {
      this.lastClick = null
      this.emit('dblclick', pick.path, event, { x: event.clientX, y: event.clientY, button: event.button })
      return
    }

    this.lastClick = { path: pick.path, at: now }
    this.emit('click', pick.path, event, { x: event.clientX, y: event.clientY, button: event.button })
  }

  private pickAt(clientX: number, clientY: number): { path: string } | null {
    const pickables = Array.from(this.opts.nodeRoots.values())
    const result = this.opts.runtime.pick(clientX, clientY, pickables)
    if (!result.object) return null
    const path = findNodePath(result.object)
    if (!path) return null
    return { path }
  }

  private applySelection(path: string): void {
    if (this.opts.readonly) return
    const rootId = path.split('/')[0]
    this.opts.doc.selection.set(rootId)
  }

  private emit(
    type: 'click' | 'dblclick' | 'longpress',
    path: string,
    originalEvent: PointerEvent,
    pointer: { x: number; y: number; button: number }
  ): void {
    const nodeId = path.split('/')[0]
    const node = this.opts.doc.getNode(nodeId)
    this.opts.onInteraction?.({
      type,
      nodePath: path,
      nodeId,
      node,
      pointer,
      originalEvent
    })
    if (type === 'click') {
      this.opts.onNodeClick?.(path, node)
    }
  }

  private clearLongPressTimer(): void {
    if (this.longPressTimer !== null) {
      clearTimeout(this.longPressTimer)
      this.longPressTimer = null
    }
  }
}

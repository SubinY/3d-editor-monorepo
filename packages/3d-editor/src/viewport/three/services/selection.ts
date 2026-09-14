/** 3D 拾取写 selection，并同步 gizmo 附着；识别 click / dblclick / longpress / hover */
import type * as THREE from 'three'
import type { EditorDocument } from '../../../document/EditorDocument'
import type { NodeInteractionHandler } from '../../interaction-events'
import type { ThreeRuntime } from '../runtime/ThreeRuntime'
import { findNodePath } from '../utils/node-path'
import { getFootprintPivot } from '../utils/footprint-pivot'
import type { HoverHighlight } from './hover-highlight'

const MOVE_THRESHOLD_PX = 5
const LONGPRESS_MS = 500
const DBLCLICK_MS = 300

export interface SelectionServiceOptions {
  doc: EditorDocument
  runtime: ThreeRuntime
  readonly: boolean
  nodeRoots: Map<string, THREE.Object3D>
  /** 增量维护的可拾取根对象；避免 pointermove 每次 Array.from */
  pickables: THREE.Object3D[]
  pathObjects: Map<string, THREE.Object3D>
  hoverOutline: boolean
  hoverHighlight: HoverHighlight
  onInteraction?: NodeInteractionHandler
}

/** 3D 点击拾取 → Document selection / Host 回调；selection → gizmo */
export class SelectionService {
  private pointerDownAt: { x: number; y: number; button: number } | null = null
  private longPressTimer: ReturnType<typeof setTimeout> | null = null
  private longPressFired = false
  private lastClick: { path: string; at: number } | null = null
  private hoverPath: string | null = null
  private pendingHover: PointerEvent | null = null
  private hoverRafId = 0

  constructor(private opts: SelectionServiceOptions) {}

  dispose(): void {
    this.clearLongPressTimer()
    this.clearHoverRaf()
    this.clearHover()
  }

  setHoverOutlineEnabled(enabled: boolean): void {
    this.opts.hoverOutline = enabled
    if (!enabled) this.clearHover()
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
    const pivot = object ? getFootprintPivot(object) : undefined
    this.opts.runtime.attachTransform(pivot ?? object ?? null)
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
    if (this.pointerDownAt && !this.longPressFired) {
      const moved = Math.hypot(event.clientX - this.pointerDownAt.x, event.clientY - this.pointerDownAt.y)
      if (moved > MOVE_THRESHOLD_PX) {
        this.clearLongPressTimer()
      }
      return
    }

    // 未按下：悬停描边（rAF 合并，只处理一帧内最后位置）
    if (this.pointerDownAt) return
    if (!this.opts.hoverOutline) return
    if (this.opts.runtime.isCapturingPointer()) {
      this.clearHover()
      return
    }

    this.pendingHover = event
    if (this.hoverRafId) return
    this.hoverRafId = requestAnimationFrame(() => {
      this.hoverRafId = 0
      const pending = this.pendingHover
      this.pendingHover = null
      if (!pending) return
      this.applyHoverFromEvent(pending)
    })
  }

  handlePointerLeave = (): void => {
    this.clearHoverRaf()
    this.clearHover()
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

  private applyHoverFromEvent(event: PointerEvent): void {
    if (!this.opts.hoverOutline) return
    if (this.opts.runtime.isCapturingPointer()) {
      this.clearHover()
      return
    }
    const pick = this.pickAt(event.clientX, event.clientY)
    const nextPath = pick?.path ?? null
    if (nextPath === this.hoverPath) return
    this.hoverPath = nextPath
    if (!nextPath) {
      this.opts.hoverHighlight.clear()
      return
    }
    this.applyHover(nextPath)
    this.emit('hover', nextPath, event, { x: event.clientX, y: event.clientY, button: event.button })
  }

  private applyHover(path: string): void {
    const root = this.opts.pathObjects.get(path)
    if (!root) {
      this.opts.hoverHighlight.clear()
      return
    }
    const nestedRoots: THREE.Object3D[] = []
    const prefix = `${path}/`
    this.opts.pathObjects.forEach((obj, p) => {
      if (p.startsWith(prefix)) nestedRoots.push(obj)
    })
    this.opts.hoverHighlight.setTarget(root, nestedRoots)
  }

  private clearHover(): void {
    if (this.hoverPath === null) return
    this.hoverPath = null
    this.opts.hoverHighlight.clear()
  }

  private clearHoverRaf(): void {
    if (this.hoverRafId) {
      cancelAnimationFrame(this.hoverRafId)
      this.hoverRafId = 0
    }
    this.pendingHover = null
  }

  private pickAt(clientX: number, clientY: number): { path: string } | null {
    const result = this.opts.runtime.pick(clientX, clientY, this.opts.pickables)
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
    type: 'click' | 'dblclick' | 'longpress' | 'hover',
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
  }

  private clearLongPressTimer(): void {
    if (this.longPressTimer !== null) {
      clearTimeout(this.longPressTimer)
      this.longPressTimer = null
    }
  }
}

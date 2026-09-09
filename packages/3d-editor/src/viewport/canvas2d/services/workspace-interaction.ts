/** 画工作区：连续落点，≥3 点闭合后 addWorkspace */
import type { PlanePoint } from '../types'
import type { PointerInteraction, Viewport2DContext } from './types'

const CLOSE_SNAP = 0.25
const MIN_LEN = 0.05

export class WorkspaceInteraction implements PointerInteraction {
  points: PlanePoint[] = []
  cursor: PlanePoint | null = null

  constructor(private host: Viewport2DContext) {}

  reset(): void {
    this.points = []
    this.cursor = null
  }

  /** 仅清空进行中的落点（不写 document） */
  endChain(): void {
    this.reset()
    this.host.requestRender()
  }

  /**
   * Esc / 右键：已有 ≥3 点则闭合提交（对齐「画完结束」）；
   * 不足 3 点则取消当前绘制。已提交的工作区不受影响。
   */
  finishOrCancel(): void {
    if (this.points.length >= 3) {
      this.commit()
      return
    }
    this.endChain()
  }

  private tryClose(point: PlanePoint): boolean {
    if (this.points.length < 3) return false
    const first = this.points[0]
    const dist = Math.hypot(point.u - first.u, point.v - first.v)
    return dist <= CLOSE_SNAP
  }

  private commit(): void {
    if (this.points.length < 3) return
    const outline = this.points.map(
      p => [p.u, p.v] as [number, number]
    )
    const ws = this.host.doc.commands.addWorkspace(outline, {
      name: `工作区${this.host.doc.getWorkspaces().length + 1}`
    })
    if (ws) {
      this.host.doc.selection.set(ws.id)
      this.host.onWorkspaceSelect?.(ws)
    }
    this.endChain()
  }

  /** Host / 键盘 Enter 闭合当前多边形 */
  tryCommitFromKeyboard(): void {
    if (this.points.length >= 3) this.commit()
  }

  onPointerDown(event: PointerEvent, plane: PlanePoint): boolean {
    if (this.host.readonly || this.host.isElevation) return false
    if (event.button === 2) {
      this.finishOrCancel()
      return true
    }
    if (event.button !== 0) return false

    if (this.points.length >= 3 && this.tryClose(plane)) {
      this.commit()
      return true
    }

    if (event.detail >= 2 && this.points.length >= 3) {
      this.commit()
      return true
    }

    const last = this.points[this.points.length - 1]
    if (last) {
      const length = Math.hypot(plane.u - last.u, plane.v - last.v)
      if (length < MIN_LEN) return true
    }
    this.points.push({ ...plane })
    this.cursor = { ...plane }
    this.host.requestRender()
    return true
  }

  onPointerMove(_event: PointerEvent, plane: PlanePoint): boolean {
    if (!this.points.length) return false
    this.cursor = { ...plane }
    this.host.requestRender()
    return true
  }

  onPointerUp(_event: PointerEvent): boolean {
    return false
  }
}

/** 2D 相机：平面↔屏幕坐标、平移与滚轮缩放 */
import type { PlanePoint } from '../types'

export class Camera2D {
  scale = 40
  offsetX = 0
  offsetY = 0

  private panning = false
  private panLast = { x: 0, y: 0 }

  constructor(private isElevation: () => boolean) {}

  worldToScreen(u: number, v: number): { sx: number; sy: number } {
    if (this.isElevation()) {
      return { sx: this.offsetX + u * this.scale, sy: this.offsetY - v * this.scale }
    }
    return { sx: this.offsetX + u * this.scale, sy: this.offsetY + v * this.scale }
  }

  screenToPlane(sx: number, sy: number): PlanePoint {
    if (this.isElevation()) {
      return { u: (sx - this.offsetX) / this.scale, v: (this.offsetY - sy) / this.scale }
    }
    return { u: (sx - this.offsetX) / this.scale, v: (sy - this.offsetY) / this.scale }
  }

  clientToPlane(canvas: HTMLCanvasElement, clientX: number, clientY: number): PlanePoint {
    const rect = canvas.getBoundingClientRect()
    return this.screenToPlane(clientX - rect.left, clientY - rect.top)
  }

  fit(
    canvasWidth: number,
    canvasHeight: number,
    extents: { spanU: number; spanV: number; centerU: number; centerV: number }
  ): void {
    const padding = 70
    const { spanU, spanV, centerU, centerV } = extents
    this.scale = Math.min(
      (canvasWidth - padding * 2) / Math.max(spanU, 0.1),
      (canvasHeight - padding * 2) / Math.max(spanV, 0.1)
    )
    this.scale = Math.min(400, Math.max(5, this.scale))
    this.offsetX = canvasWidth / 2 - centerU * this.scale
    this.offsetY = this.isElevation()
      ? canvasHeight / 2 + centerV * this.scale
      : canvasHeight / 2 - centerV * this.scale
  }

  /**
   * @param mode select：中键 / 右键 / Shift+拖 平移；pan：左键也可平移；off：仅中键
   */
  tryBeginPan(event: PointerEvent, mode: 'off' | 'select' | 'pan'): boolean {
    const middle = event.button === 1
    const aux =
      mode === 'select' && (event.button === 2 || event.shiftKey)
    const left = mode === 'pan' && event.button === 0
    if (!middle && !aux && !left) return false
    this.panning = true
    this.panLast = { x: event.clientX, y: event.clientY }
    return true
  }

  onPanMove(event: PointerEvent): boolean {
    if (!this.panning) return false
    this.offsetX += event.clientX - this.panLast.x
    this.offsetY += event.clientY - this.panLast.y
    this.panLast = { x: event.clientX, y: event.clientY }
    return true
  }

  endPan(): boolean {
    if (!this.panning) return false
    this.panning = false
    return true
  }

  get isPanning(): boolean {
    return this.panning
  }

  zoomAt(canvas: HTMLCanvasElement, clientX: number, clientY: number, deltaY: number): void {
    const rect = canvas.getBoundingClientRect()
    const sx = clientX - rect.left
    const sy = clientY - rect.top
    const before = this.screenToPlane(sx, sy)
    const factor = deltaY < 0 ? 1.1 : 1 / 1.1
    this.scale = Math.min(400, Math.max(5, this.scale * factor))
    const after = this.worldToScreen(before.u, before.v)
    this.offsetX += sx - after.sx
    this.offsetY += sy - after.sy
  }
}

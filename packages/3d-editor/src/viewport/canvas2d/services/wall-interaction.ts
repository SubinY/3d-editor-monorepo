/** 画墙模式：连续落点成链，写回 addWall */
import { snapWallPoint } from '../utils/wall-snap'
import type { PlanePoint } from '../types'
import type { PointerInteraction, Viewport2DContext } from './types'

/** 连续画墙 */
export class WallInteraction implements PointerInteraction {
  chainLast: PlanePoint | null = null
  chainCursor: PlanePoint | null = null

  constructor(private host: Viewport2DContext) {}

  reset(): void {
    this.chainLast = null
    this.chainCursor = null
  }

  endChain(): void {
    this.reset()
    this.host.requestRender()
  }

  onPointerDown(event: PointerEvent, plane: PlanePoint): boolean {
    if (this.host.readonly || this.host.isElevation) return false
    if (event.button === 2) {
      this.endChain()
      return true
    }
    if (event.button !== 0) return false

    const point = snapWallPoint(plane.u, plane.v, this.host.doc.getWalls(), this.chainLast)
    if (!this.chainLast) {
      this.chainLast = point
      this.chainCursor = point
    } else {
      const length = Math.hypot(point.u - this.chainLast.u, point.v - this.chainLast.v)
      if (length > 0.05) {
        this.host.doc.commands.addWall([this.chainLast.u, this.chainLast.v], [point.u, point.v])
        this.chainLast = point
      }
    }
    this.host.requestRender()
    return true
  }

  onPointerMove(_event: PointerEvent, plane: PlanePoint): boolean {
    if (!this.chainLast) return false
    this.chainCursor = snapWallPoint(plane.u, plane.v, this.host.doc.getWalls(), this.chainLast)
    this.host.requestRender()
    return true
  }

  onPointerUp(_event: PointerEvent): boolean {
    return false
  }
}

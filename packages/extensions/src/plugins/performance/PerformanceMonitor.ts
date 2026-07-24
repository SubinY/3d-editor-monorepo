import type { CoreContext } from '@3d-editor/editor'

export interface PerformanceStats {
  fps: number
  drawCalls: number
  triangles: number
}

export class PerformanceMonitor {
  private lastTime = performance.now()
  private frame = 0
  private fps = 0

  constructor(private ctx: CoreContext) {}

  update(): PerformanceStats {
    const now = performance.now()
    this.frame++
    if (now - this.lastTime >= 1000) {
      this.fps = (this.frame * 1000) / (now - this.lastTime)
      this.frame = 0
      this.lastTime = now
    }
    const rendererInfo = this.ctx.renderer.renderer.info
    return {
      fps: Math.round(this.fps),
      drawCalls: rendererInfo.render.calls,
      triangles: rendererInfo.render.triangles
    }
  }
}



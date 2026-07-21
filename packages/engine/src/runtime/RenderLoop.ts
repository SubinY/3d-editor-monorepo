type LoopCallback = (delta: number) => void

export class RenderLoop {
  private rafId: number | null = null
  private lastTime = 0

  start(callback: LoopCallback): void {
    const step = (time: number) => {
      const delta = this.lastTime ? (time - this.lastTime) / 1000 : 0
      this.lastTime = time
      callback(delta)
      this.rafId = requestAnimationFrame(step)
    }
    this.rafId = requestAnimationFrame(step)
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
      this.lastTime = 0
    }
  }
}

import type * as THREE from 'three'

/** DOM 刷新间隔（ms）；游戏 FPS 面板常见 200–500ms */
const UI_INTERVAL_MS = 250
/** 指数滑动平均系数；越小越稳、响应越慢 */
const EMA_ALPHA = 0.12

/**
 * 3D 视口左下角性能 Info（对齐 Three.js 编辑器风格）。
 * 「渲染时间」= 本帧 render 前后耗时；显示为 EMA + 低频刷新，避免数字狂跳。
 * 计数直接读 renderer.info（drawcall / 三角形 / 几何 / 贴图），零成本。
 */
export class PerfStatsOverlay {
  private el: HTMLDivElement
  private visible = false
  private smoothedMs = 0
  private lastUiAt = 0

  constructor(container: HTMLElement) {
    this.el = document.createElement('div')
    this.el.className = 'editor-perf-stats'
    Object.assign(this.el.style, {
      position: 'absolute',
      left: '10px',
      bottom: '10px',
      zIndex: '5',
      pointerEvents: 'none',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      fontSize: '12px',
      lineHeight: '1.55',
      color: 'rgba(255,255,255,0.88)',
      textShadow: '0 1px 2px rgba(0,0,0,0.65)',
      whiteSpace: 'pre',
      display: 'none'
    })
    const cs = getComputedStyle(container)
    if (cs.position === 'static') container.style.position = 'relative'
    container.appendChild(this.el)
  }

  setVisible(visible: boolean): void {
    this.visible = visible
    this.el.style.display = visible ? 'block' : 'none'
    if (visible) {
      this.smoothedMs = 0
      this.lastUiAt = 0
    }
  }

  isVisible(): boolean {
    return this.visible
  }

  /**
   * @param renderer 提供 info.render / info.memory
   * @param renderMs 本帧 render 前后耗时（ms）
   */
  update(renderer: THREE.WebGLRenderer, renderMs: number): void {
    if (!this.visible) return

    this.smoothedMs =
      this.smoothedMs === 0
        ? renderMs
        : this.smoothedMs * (1 - EMA_ALPHA) + renderMs * EMA_ALPHA

    const now = performance.now()
    if (now - this.lastUiAt < UI_INTERVAL_MS && this.lastUiAt !== 0) return
    this.lastUiAt = now

    const { calls, triangles } = renderer.info.render
    const { geometries, textures } = renderer.info.memory

    this.el.textContent =
      `${calls} drawcall\n` +
      `${Math.floor(triangles).toLocaleString('en-US')} 三角形\n` +
      `${geometries} 几何 / ${textures} 贴图\n` +
      `${this.smoothedMs.toFixed(2)} 渲染时间`

    console.log(geometries, textures, 'textures')
  }

  dispose(): void {
    this.el.remove()
  }
}

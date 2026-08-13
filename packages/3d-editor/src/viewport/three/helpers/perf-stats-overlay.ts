import type * as THREE from 'three'

/** DOM 刷新间隔（ms）；游戏 FPS 面板常见 200–500ms */
const UI_INTERVAL_MS = 250
/** 指数滑动平均系数；越小越稳、响应越慢 */
const EMA_ALPHA = 0.12

/**
 * 3D 视口左下角性能 Info（对齐 Three.js 编辑器风格）。
 * 「渲染时间」= 本帧 render 前后耗时；显示为 EMA + 低频刷新，避免数字狂跳。
 */
export class PerfStatsOverlay {
  private el: HTMLDivElement
  private visible = false
  private smoothedMs = 0
  private lastUiAt = 0
  private cachedCounts = { objects: 0, vertices: 0, triangles: 0 }

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
   * @param renderMs 本帧 render 前后耗时（ms）
   */
  update(scene: THREE.Scene, renderMs: number): void {
    if (!this.visible) return

    this.smoothedMs =
      this.smoothedMs === 0
        ? renderMs
        : this.smoothedMs * (1 - EMA_ALPHA) + renderMs * EMA_ALPHA

    const now = performance.now()
    if (now - this.lastUiAt < UI_INTERVAL_MS && this.lastUiAt !== 0) return
    this.lastUiAt = now

    let objects = 0
    let vertices = 0
    let triangles = 0
    scene.traverse(obj => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh || !mesh.geometry) return
      objects += 1
      const geo = mesh.geometry
      const pos = geo.attributes.position
      if (pos) vertices += pos.count
      if (geo.index) {
        triangles += geo.index.count / 3
      } else if (pos) {
        triangles += pos.count / 3
      }
    })
    this.cachedCounts = { objects, vertices, triangles }

    this.el.textContent =
      `${this.cachedCounts.objects} 物体\n` +
      `${this.cachedCounts.vertices.toLocaleString('en-US')} 顶点\n` +
      `${Math.floor(this.cachedCounts.triangles).toLocaleString('en-US')} 三角形\n` +
      `${this.smoothedMs.toFixed(2)} 渲染时间`
  }

  dispose(): void {
    this.el.remove()
  }
}

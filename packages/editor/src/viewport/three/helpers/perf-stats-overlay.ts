import type * as THREE from 'three'

/**
 * 3D 视口左下角性能 Info（对齐 Three.js 编辑器风格）。
 * 默认隐藏；由 Host / Viewport3D 开关。
 */
export class PerfStatsOverlay {
  private el: HTMLDivElement
  private visible = false
  private lastTime = 0
  private frameMs = 0

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
    if (visible) this.lastTime = performance.now()
  }

  isVisible(): boolean {
    return this.visible
  }

  /** 在渲染环内调用；仅 visible 时更新 DOM */
  update(scene: THREE.Scene): void {
    if (!this.visible) return
    const now = performance.now()
    if (this.lastTime > 0) this.frameMs = now - this.lastTime
    this.lastTime = now

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

    this.el.textContent =
      `${objects} 物体\n` +
      `${vertices.toLocaleString('en-US')} 顶点\n` +
      `${Math.floor(triangles).toLocaleString('en-US')} 三角形\n` +
      `${this.frameMs.toFixed(2)} 帧时`
  }

  dispose(): void {
    this.el.remove()
  }
}

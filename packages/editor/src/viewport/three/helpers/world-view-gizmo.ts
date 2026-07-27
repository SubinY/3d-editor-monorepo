import * as THREE from 'three'

export type AxisId = 'x' | 'y' | 'z'
export type AxisSign = 1 | -1

export interface AxisHit {
  axis: AxisId
  sign: AxisSign
}

export interface CameraAlongAxisResult {
  position: [number, number, number]
  up: [number, number, number]
}

const AXIS_COLORS: Record<AxisId, number> = {
  x: 0xe74c3c,
  y: 0x2ecc71,
  z: 0x3498db
}

const AXIS_LABELS: Record<AxisId, string> = {
  x: 'X',
  y: 'Y',
  z: 'Z'
}

/** 给定 orbit target / 半径 / 轴，计算主相机位姿（立刻切视角，无动画） */
export function cameraPoseAlongAxis(
  target: [number, number, number],
  radius: number,
  axis: AxisId,
  sign: AxisSign
): CameraAlongAxisResult {
  const r = Math.max(radius, 1e-3)
  const [tx, ty, tz] = target
  if (axis === 'x') {
    return {
      position: [tx + sign * r, ty, tz],
      up: [0, 1, 0]
    }
  }
  if (axis === 'y') {
    // 顶视 / 底视：调整 up，避免 lookAt 翻滚不稳定
    return {
      position: [tx, ty + sign * r, tz],
      up: sign > 0 ? [0, 0, -1] : [0, 0, 1]
    }
  }
  return {
    position: [tx, ty, tz + sign * r],
    up: [0, 1, 0]
  }
}

export interface WorldViewGizmoOptions {
  /** 角标边长（CSS 像素） */
  size?: number
  /** 距画布右/下边距（CSS 像素） */
  margin?: number
}

/**
 * 右下角世界坐标轴角标：点 ±X/±Y/±Z 切主相机视角；区域内拖拽环绕由 Runtime 驱动。
 * 不进 Document.environment.helpers。
 */
export class WorldViewGizmo {
  readonly size: number
  readonly margin: number

  private scene = new THREE.Scene()
  private camera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 20)
  private root = new THREE.Group()
  private pickables: THREE.Object3D[] = []
  private raycaster = new THREE.Raycaster()
  private pointer = new THREE.Vector2()
  private tmpPos = new THREE.Vector3()
  private tmpTarget = new THREE.Vector3()

  constructor(options: WorldViewGizmoOptions = {}) {
    this.size = options.size ?? 112
    this.margin = options.margin ?? 12
    this.camera.position.set(0, 0, 5)
    this.camera.lookAt(0, 0, 0)
    this.scene.add(this.root)
    this.buildAxes()
  }

  /** 角标在 canvas 内的矩形（CSS 像素，原点左上） */
  getRect(canvasWidth: number, canvasHeight: number): {
    x: number
    y: number
    width: number
    height: number
  } {
    return {
      x: canvasWidth - this.size - this.margin,
      y: canvasHeight - this.size - this.margin,
      width: this.size,
      height: this.size
    }
  }

  containsClientPoint(
    clientX: number,
    clientY: number,
    canvasRect: DOMRect
  ): boolean {
    const x = clientX - canvasRect.left
    const y = clientY - canvasRect.top
    const r = this.getRect(canvasRect.width, canvasRect.height)
    return x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height
  }

  /** 在角标 viewport 内射线拾取轴球 */
  pickAxis(
    clientX: number,
    clientY: number,
    canvasRect: DOMRect
  ): AxisHit | null {
    const r = this.getRect(canvasRect.width, canvasRect.height)
    const x = clientX - canvasRect.left
    const y = clientY - canvasRect.top
    if (x < r.x || x > r.x + r.width || y < r.y || y > r.y + r.height) return null

    this.pointer.x = ((x - r.x) / r.width) * 2 - 1
    this.pointer.y = -((y - r.y) / r.height) * 2 + 1
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const hits = this.raycaster.intersectObjects(this.pickables, false)
    const hit = hits[0]?.object
    if (!hit) return null
    const axis = hit.userData.axis as AxisId | undefined
    const sign = hit.userData.sign as AxisSign | undefined
    if (!axis || (sign !== 1 && sign !== -1)) return null
    return { axis, sign }
  }

  /** 主相机相对 target 的朝向 → 角标相机 */
  syncFromCamera(mainCamera: THREE.Camera, target: THREE.Vector3): void {
    this.tmpPos.copy(mainCamera.position).sub(target)
    if (this.tmpPos.lengthSq() < 1e-8) this.tmpPos.set(0, 0, 1)
    this.tmpPos.normalize().multiplyScalar(5)
    this.camera.position.copy(this.tmpPos)
    this.camera.up.copy(mainCamera.up)
    this.tmpTarget.set(0, 0, 0)
    this.camera.lookAt(this.tmpTarget)
    this.camera.updateMatrixWorld()
  }

  render(renderer: THREE.WebGLRenderer): void {
    const el = renderer.domElement
    const width = el.clientWidth
    const height = el.clientHeight
    const rect = this.getRect(width, height)
    const pr = renderer.getPixelRatio()

    const prevAutoClear = renderer.autoClear
    renderer.autoClear = false
    renderer.clearDepth()
    renderer.setViewport(
      rect.x * pr,
      (height - rect.y - rect.height) * pr,
      rect.width * pr,
      rect.height * pr
    )
    renderer.setScissor(
      rect.x * pr,
      (height - rect.y - rect.height) * pr,
      rect.width * pr,
      rect.height * pr
    )
    renderer.setScissorTest(true)
    renderer.render(this.scene, this.camera)
    renderer.setScissorTest(false)
    renderer.setViewport(0, 0, width * pr, height * pr)
    renderer.autoClear = prevAutoClear
  }

  dispose(): void {
    this.root.traverse(obj => {
      const mesh = obj as THREE.Mesh | THREE.Line | THREE.Sprite
      if ('geometry' in mesh && mesh.geometry) mesh.geometry.dispose()
      const mat = (mesh as THREE.Mesh).material
      if (!mat) return
      const mats = Array.isArray(mat) ? mat : [mat]
      for (const m of mats) {
        const map = (m as THREE.SpriteMaterial).map
        if (map) map.dispose()
        m.dispose()
      }
    })
    this.pickables = []
  }

  private buildAxes(): void {
    const axes: AxisId[] = ['x', 'y', 'z']
    for (const axis of axes) {
      const color = AXIS_COLORS[axis]
      const dir = new THREE.Vector3(
        axis === 'x' ? 1 : 0,
        axis === 'y' ? 1 : 0,
        axis === 'z' ? 1 : 0
      )

      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        dir.clone().multiplyScalar(-1.1),
        dir.clone().multiplyScalar(1.1)
      ])
      const line = new THREE.Line(
        lineGeo,
        new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true })
      )
      line.renderOrder = 1
      this.root.add(line)

      this.root.add(this.makeHandle(dir, 1, color, axis, 1, true))
      this.root.add(this.makeHandle(dir, -1, color, axis, -1, false))
    }
  }

  private makeHandle(
    dir: THREE.Vector3,
    along: number,
    color: number,
    axis: AxisId,
    sign: AxisSign,
    labeled: boolean
  ): THREE.Sprite {
    const scale = labeled ? 0.72 : 0.4
    const mat = new THREE.SpriteMaterial({
      map: createAxisTexture(labeled ? AXIS_LABELS[axis] : null, color),
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: labeled ? 1 : 0.9
    })
    const sprite = new THREE.Sprite(mat)
    sprite.scale.set(scale, scale, 1)
    sprite.position.copy(dir).multiplyScalar(along * 1.15)
    sprite.renderOrder = 2
    sprite.userData.axis = axis
    sprite.userData.sign = sign
    this.pickables.push(sprite)
    return sprite
  }
}

function createAxisTexture(label: string | null, bgColor: number): THREE.CanvasTexture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, size, size)

  const r = ((bgColor >> 16) & 0xff).toString(16).padStart(2, '0')
  const g = ((bgColor >> 8) & 0xff).toString(16).padStart(2, '0')
  const b = (bgColor & 0xff).toString(16).padStart(2, '0')
  ctx.fillStyle = `#${r}${g}${b}`
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2)
  ctx.fill()

  if (label) {
    ctx.fillStyle = '#111'
    ctx.font = 'bold 72px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, size / 2, size / 2 + 4)
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

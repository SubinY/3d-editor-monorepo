import type { TransformMode } from '../../../core/types'
import type { CameraViewType, DefaultViewJSON } from '../../../document/types'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DEFAULT_TRANSLATION_SNAP } from '../../../core/interaction'

export interface TransformSnapshot {
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
}

export type TransformEndHandler = (payload: {
  id: string
  before: TransformSnapshot
  after: TransformSnapshot
}) => void

/** Orbit 当前位姿（供 Host 表单同步） */
export interface CameraPoseSnapshot {
  position: [number, number, number]
  target: [number, number, number]
  radius: number
}

export type CameraPoseHandler = (pose: CameraPoseSnapshot) => void

export interface ThreeRuntimeOptions {
  container: HTMLElement
  /** false 时不创建 gizmo（只读预览） */
  enableTransform?: boolean
  transformMode?: TransformMode
}

/**
 * 精简 3D 管线：渲染 / 相机 / Orbit / gizmo / 拾取 / GLTF。
 * - orbit：透视，可旋转/平移/缩放
 * - orthographic：正交，禁旋转（平面图，仅平移/缩放）
 */
export class ThreeRuntime {
  public readonly scene: THREE.Scene
  public readonly renderer: THREE.WebGLRenderer
  public readonly orbit: OrbitControls
  public readonly transform: TransformControls | null

  private _camera: THREE.PerspectiveCamera | THREE.OrthographicCamera
  private cameraMode: CameraViewType = 'orbit'
  /** 正交相机视窗高度（米），对应 defaultView.fov */
  private orthoSize = 20

  private container: HTMLElement
  private loopId: number | null = null
  private transformBefore?: TransformSnapshot
  private transformEndHandlers = new Set<TransformEndHandler>()
  private cameraPoseHandlers = new Set<CameraPoseHandler>()
  private suppressPoseEvents = false
  private raycaster = new THREE.Raycaster()
  private pointer = new THREE.Vector2()
  private allowedModes: TransformMode[] = ['translate']
  private translationSnapSize = DEFAULT_TRANSLATION_SNAP

  constructor(options: ThreeRuntimeOptions) {
    this.container = options.container
    this.scene = new THREE.Scene()

    const aspect = options.container.clientWidth / Math.max(options.container.clientHeight, 1) || 1
    this._camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 2000)
    this._camera.position.set(0, 5, 10)

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      logarithmicDepthBuffer: true
    })
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.setSize(options.container.clientWidth, options.container.clientHeight)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    options.container.appendChild(this.renderer.domElement)

    this.orbit = new OrbitControls(this._camera, this.renderer.domElement)
    this.orbit.enableDamping = false
    this.orbit.addEventListener('change', this.handleOrbitChange)

    if (options.enableTransform !== false) {
      this.transform = new TransformControls(this._camera, this.renderer.domElement)
      this.transform.setMode(options.transformMode ?? 'translate')
      this.transform.addEventListener('dragging-changed', this.handleDraggingChanged)
      this.scene.add(this.transform)
    } else {
      this.transform = null
    }

    window.addEventListener('resize', this.handleResize)
    this.handleResize()
    this.startLoop()
  }

  get camera(): THREE.PerspectiveCamera | THREE.OrthographicCamera {
    return this._camera
  }

  get domElement(): HTMLCanvasElement {
    return this.renderer.domElement
  }

  onTransformEnd(handler: TransformEndHandler): () => void {
    this.transformEndHandlers.add(handler)
    return () => this.transformEndHandlers.delete(handler)
  }

  getCameraPose(): CameraPoseSnapshot {
    const pos = this._camera.position
    const target = this.orbit.target
    return {
      position: [pos.x, pos.y, pos.z],
      target: [target.x, target.y, target.z],
      radius: pos.distanceTo(target) || 1
    }
  }

  /** 当前位姿是否已接近给定 position/target（避免 Orbit 回写时二次跳变） */
  poseNear(
    position: [number, number, number],
    target: [number, number, number],
    eps = 1e-3
  ): boolean {
    const p = this._camera.position
    const t = this.orbit.target
    return (
      Math.abs(p.x - position[0]) < eps &&
      Math.abs(p.y - position[1]) < eps &&
      Math.abs(p.z - position[2]) < eps &&
      Math.abs(t.x - target[0]) < eps &&
      Math.abs(t.y - target[1]) < eps &&
      Math.abs(t.z - target[2]) < eps
    )
  }

  onCameraPoseChange(handler: CameraPoseHandler): () => void {
    this.cameraPoseHandlers.add(handler)
    return () => this.cameraPoseHandlers.delete(handler)
  }

  attachTransform(object: THREE.Object3D | null): void {
    if (!this.transform) return
    if (object) this.transform.attach(object)
    else this.transform.detach()
  }

  getAttachedObject(): THREE.Object3D | null {
    return (this.transform?.object as THREE.Object3D | undefined) ?? null
  }

  setAllowedModes(modes: TransformMode[]): void {
    this.allowedModes = modes.length ? [...modes] : ['translate']
    if (!this.allowedModes.includes(this.getTransformMode())) {
      this.setMode(this.allowedModes[0] ?? 'translate')
    }
  }

  setMode(mode: TransformMode): void {
    if (!this.transform || !this.allowedModes.includes(mode)) return
    this.transform.setMode(mode)
  }

  getTransformMode(): TransformMode {
    return (this.transform?.getMode() as TransformMode | undefined) ?? 'translate'
  }

  setTranslationSnap(enabled: boolean, size = this.translationSnapSize): void {
    this.translationSnapSize = size
    if (!this.transform) return
    this.transform.translationSnap = enabled ? size : null
    this.transform.rotationSnap = enabled ? Math.PI / 12 : null
  }

  setShadowMap(options: { enabled: boolean; type?: 'basic' | 'pcfsoft' }): void {
    this.renderer.shadowMap.enabled = options.enabled
    this.renderer.shadowMap.type =
      options.type === 'basic' ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap
    this.renderer.shadowMap.needsUpdate = true
  }

  /**
   * 按 defaultView 写入相机。
   * applyPose=false：只改类型 / 投影 / 距离限制，保留当前 Orbit 位姿。
   */
  applyDefaultView(view: DefaultViewJSON, options?: { applyPose?: boolean }): void {
    const applyPose = options?.applyPose !== false
    const mode = view.type === 'orthographic' ? 'orthographic' : 'orbit'

    this.suppressPoseEvents = true
    this.setCameraMode(mode)

    if (applyPose) {
      this._camera.position.set(view.position[0], view.position[1], view.position[2])
      this.orbit.target.set(view.target[0], view.target[1], view.target[2])
    }

    if (mode === 'orbit' && this._camera instanceof THREE.PerspectiveCamera) {
      if (view.fov != null) this._camera.fov = view.fov
    }

    if (mode === 'orthographic' && this._camera instanceof THREE.OrthographicCamera) {
      if (view.fov != null && view.fov > 0) this.orthoSize = Math.max(view.fov, 1)
      if (applyPose) this._camera.zoom = 1
      this.syncOrthoFrustum()
    }

    if (view.minDistance != null) this.orbit.minDistance = view.minDistance
    if (view.maxDistance != null) this.orbit.maxDistance = view.maxDistance

    this._camera.updateProjectionMatrix()
    if (applyPose) this._camera.lookAt(this.orbit.target)
    this.orbit.update()
    this.suppressPoseEvents = false
  }

  /** 切换旋转 / 正交，保留当前位置与 target */
  setCameraMode(mode: CameraViewType): void {
    if (mode === this.cameraMode) {
      this.applyOrbitPolicy(mode)
      return
    }

    const pos = this._camera.position.clone()
    const near = this._camera.near
    const far = this._camera.far
    const target = this.orbit.target.clone()
    const aspect =
      this.container.clientWidth / Math.max(this.container.clientHeight, 1) || 1

    const next: THREE.PerspectiveCamera | THREE.OrthographicCamera =
      mode === 'orthographic'
        ? new THREE.OrthographicCamera(-1, 1, 1, -1, near, far)
        : new THREE.PerspectiveCamera(
            this._camera instanceof THREE.PerspectiveCamera ? this._camera.fov : 50,
            aspect,
            near,
            far
          )

    if (next instanceof THREE.OrthographicCamera) {
      next.zoom = this._camera instanceof THREE.OrthographicCamera ? this._camera.zoom : 1
    }

    next.position.copy(pos)
    this._camera = next
    this.cameraMode = mode
    this.orbit.object = next
    if (this.transform) {
      ;(this.transform as unknown as { camera: THREE.Camera }).camera = next
    }

    this.orbit.target.copy(target)
    this.applyOrbitPolicy(mode)
    this.handleResize()
    next.lookAt(target)
    this.orbit.update()
  }

  pick(
    clientX: number,
    clientY: number,
    objects: THREE.Object3D[]
  ): { object: THREE.Object3D | null; point?: THREE.Vector3 } {
    const { width, height, left, top } = this.domElement.getBoundingClientRect()
    this.pointer.x = ((clientX - left) / width) * 2 - 1
    this.pointer.y = -((clientY - top) / height) * 2 + 1
    this.raycaster.setFromCamera(this.pointer, this._camera)
    const hits = this.raycaster.intersectObjects(objects, true)
    const valid = hits.find(hit => !hit.object.userData.nonSelectable)
    if (!valid) return { object: null }
    return { object: valid.object, point: valid.point }
  }

  async loadGLTF(url: string): Promise<{ scene: THREE.Group | THREE.Object3D }> {
    const gltf = await new GLTFLoader().loadAsync(url)
    return { scene: gltf.scene }
  }

  dispose(): void {
    window.removeEventListener('resize', this.handleResize)
    this.orbit.removeEventListener('change', this.handleOrbitChange)
    if (this.transform) {
      this.transform.removeEventListener('dragging-changed', this.handleDraggingChanged)
      this.transform.dispose()
    }
    this.stopLoop()
    this.orbit.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
    this.transformEndHandlers.clear()
    this.cameraPoseHandlers.clear()
  }

  private applyOrbitPolicy(mode: CameraViewType): void {
    this.orbit.enablePan = true
    this.orbit.enableZoom = true
    if (mode === 'orthographic') {
      this.orbit.enableRotate = false
      this.orbit.screenSpacePanning = true
      this.orbit.minZoom = 0.05
      this.orbit.maxZoom = 50
    } else {
      this.orbit.enableRotate = true
      this.orbit.minZoom = 0
      this.orbit.maxZoom = Infinity
    }
  }

  private syncOrthoFrustum(): void {
    if (!(this._camera instanceof THREE.OrthographicCamera)) return
    const aspect =
      this.container.clientWidth / Math.max(this.container.clientHeight, 1)
    const h = this.orthoSize
    this._camera.left = (-h * aspect) / 2
    this._camera.right = (h * aspect) / 2
    this._camera.top = h / 2
    this._camera.bottom = -h / 2
    this._camera.updateProjectionMatrix()
  }

  private startLoop(): void {
    const step = () => {
      this.orbit.update()
      this.renderer.render(this.scene, this._camera)
      this.loopId = requestAnimationFrame(step)
    }
    this.loopId = requestAnimationFrame(step)
  }

  private stopLoop(): void {
    if (this.loopId === null) return
    cancelAnimationFrame(this.loopId)
    this.loopId = null
  }

  private handleResize = (): void => {
    const width = this.container.clientWidth
    const height = Math.max(this.container.clientHeight, 1)
    if (this._camera instanceof THREE.PerspectiveCamera) {
      this._camera.aspect = width / height
      this._camera.updateProjectionMatrix()
    } else {
      this.syncOrthoFrustum()
    }
    this.renderer.setSize(width, height)
  }

  private captureTransform(object: THREE.Object3D): TransformSnapshot {
    return {
      position: object.position.toArray() as [number, number, number],
      rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
      scale: object.scale.toArray() as [number, number, number]
    }
  }

  private handleOrbitChange = (): void => {
    if (this.suppressPoseEvents || this.cameraPoseHandlers.size === 0) return
    const pose = this.getCameraPose()
    this.cameraPoseHandlers.forEach(handler => handler(pose))
  }

  private handleDraggingChanged = (event: { value: unknown }): void => {
    const isDragging = event.value === true
    this.orbit.enabled = !isDragging
    const object = this.transform?.object as THREE.Object3D | undefined
    if (isDragging) {
      if (object) this.transformBefore = this.captureTransform(object)
      return
    }
    if (object && this.transformBefore) {
      const after = this.captureTransform(object)
      const payload = { id: object.uuid, before: this.transformBefore, after }
      this.transformEndHandlers.forEach(handler => handler(payload))
    }
    this.transformBefore = undefined
  }
}

import type { TransformMode } from '../../../core/types'
import type { CameraViewType, DefaultViewJSON } from '../../../document/types'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as cloneGltfGraph } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { DEFAULT_TRANSLATION_SNAP } from '../../../core/interaction'
import {
  cameraPoseAlongAxis,
  WorldViewGizmo,
  type AxisHit
} from '../helpers/world-view-gizmo'
import { PerfStatsOverlay } from '../helpers/perf-stats-overlay'
import { disposeObject3D } from '../utils/dispose'

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

/** 渲染循环回调；nowMs = performance.now() */
export type FrameHandler = (nowMs: number) => void

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
  private frameHandlers = new Set<FrameHandler>()
  private suppressPoseEvents = false
  private raycaster = new THREE.Raycaster()
  private pointer = new THREE.Vector2()
  private allowedModes: TransformMode[] = ['translate']
  private translationSnapSize = DEFAULT_TRANSLATION_SNAP

  private viewGizmo = new WorldViewGizmo()
  /** 与 TransformControls 同开关：readonly 预览不画、不拦指针 */
  private readonly viewGizmoEnabled: boolean
  private perfStats: PerfStatsOverlay
  private gizmoPointer: {
    pointerId: number
    startX: number
    startY: number
    lastX: number
    lastY: number
    hit: AxisHit | null
    dragged: boolean
    orbitWasEnabled: boolean
  } | null = null
  private spherical = new THREE.Spherical()
  private offset = new THREE.Vector3()
  private quat = new THREE.Quaternion()
  private quatInverse = new THREE.Quaternion()
  private yAxis = new THREE.Vector3(0, 1, 0)
  private gltfSources = new Map<string, { scene: THREE.Object3D; refs: number }>()
  private gltfLoading = new Map<string, Promise<THREE.Object3D>>()

  constructor(options: ThreeRuntimeOptions) {
    this.container = options.container
    this.scene = new THREE.Scene()

    const aspect = options.container.clientWidth / Math.max(options.container.clientHeight, 1) || 1
    this._camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 2000)
    this._camera.position.set(0, 5, 10)

    // logarithmicDepthBuffer：创建时一次性选定，运行时不可改。
    // 关：电房尺度够用，自定义 ShaderMaterial 不必依赖 log 深度编码。
    // 若以后 far/near 比值很大且远处 z-fight，可再打开；打开后自定义 shader 需 `#include <logdepthbuf_*>`。
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      logarithmicDepthBuffer: false
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(options.container.clientWidth, options.container.clientHeight)
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    // 静态场景不每帧重渲阴影；结构变化时由 Viewport3D 置 needsUpdate
    this.renderer.shadowMap.autoUpdate = false
    this.renderer.shadowMap.needsUpdate = true
    options.container.appendChild(this.renderer.domElement)

    this.orbit = new OrbitControls(this._camera, this.renderer.domElement)
    this.orbit.enableDamping = false
    this.orbit.addEventListener('change', this.handleOrbitChange)

    if (options.enableTransform !== false) {
      this.transform = new TransformControls(this._camera, this.renderer.domElement)
      this.transform.setMode(options.transformMode ?? 'translate')
      this.transform.addEventListener('dragging-changed', this.handleDraggingChanged)
      // 拖拽中物体已动、文档尚未写回；需按帧标记阴影（idle 仍不重渲）
      this.transform.addEventListener('objectChange', this.handleTransformObjectChange)
      this.scene.add(this.transform)
    } else {
      this.transform = null
    }

    this.viewGizmoEnabled = options.enableTransform !== false
    if (this.viewGizmoEnabled) {
      const dom = this.renderer.domElement
      dom.addEventListener('pointerdown', this.handleGizmoPointerDown, true)
      window.addEventListener('pointermove', this.handleGizmoPointerMove)
      window.addEventListener('pointerup', this.handleGizmoPointerUp)
      window.addEventListener('pointercancel', this.handleGizmoPointerUp)
    }

    this.perfStats = new PerfStatsOverlay(options.container)

    window.addEventListener('resize', this.handleResize)
    this.handleResize()
    this.startLoop()
  }

  setPerfStatsVisible(visible: boolean): void {
    this.perfStats.setVisible(visible)
  }

  isPerfStatsVisible(): boolean {
    return this.perfStats.isVisible()
  }

  get camera(): THREE.PerspectiveCamera | THREE.OrthographicCamera {
    return this._camera
  }

  get domElement(): HTMLCanvasElement {
    return this.renderer.domElement
  }

  /** 世界坐标轴角标是否正在处理指针（选中拾取应跳过） */
  isCapturingPointer(): boolean {
    return this.gizmoPointer !== null
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

  /** 每帧渲染前回调（视觉脉冲等）；返回取消订阅 */
  onFrame(handler: FrameHandler): () => void {
    this.frameHandlers.add(handler)
    return () => this.frameHandlers.delete(handler)
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

  /** 场景结构变化后请求下一帧重渲阴影贴图（配合 autoUpdate=false） */
  markShadowNeedsUpdate(): void {
    this.renderer.shadowMap.needsUpdate = true
  }

  /**
   * 按 defaultView 写入相机。
   * applyPose=false：只改类型 / 投影 / 距离限制，保留当前 Orbit 位姿。
   */
  applyView(
    view: DefaultViewJSON,
    options?: { applyPose?: boolean; up?: [number, number, number] }
  ): void {
    const applyPose = options?.applyPose !== false
    const mode = view.type === 'orthographic' ? 'orthographic' : 'orbit'

    this.suppressPoseEvents = true
    this.setProjection(mode)

    if (applyPose) {
      const up = options?.up ?? [0, 1, 0]
      this._camera.up.set(up[0], up[1], up[2])
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
  setProjection(mode: CameraViewType): void {
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

  getProjection(): CameraViewType {
    return this.cameraMode
  }

  /** 沿当前视线方向框住物体（透视调距离；正交调 orthoSize） */
  focusObject(object: THREE.Object3D, padding = 1.4): void {
    const box = new THREE.Box3().setFromObject(object)
    if (box.isEmpty()) return

    const center = new THREE.Vector3()
    const size = new THREE.Vector3()
    box.getCenter(center)
    box.getSize(size)
    const maxDim = Math.max(size.x, size.y, size.z, 0.01)

    const dir = this._camera.position.clone().sub(this.orbit.target)
    if (dir.lengthSq() < 1e-8) dir.set(1, 0.8, 1)
    dir.normalize()

    if (this._camera instanceof THREE.PerspectiveCamera) {
      const fov = THREE.MathUtils.degToRad(this._camera.fov)
      const distance = Math.max(0.5, (maxDim / (2 * Math.tan(fov / 2))) * padding)
      this.orbit.target.copy(center)
      this._camera.position.copy(center).addScaledVector(dir, distance)
      this._camera.lookAt(center)
    } else {
      this.orbit.target.copy(center)
      const distance = this._camera.position.distanceTo(center) || maxDim * 2
      this._camera.position.copy(center).addScaledVector(dir, Math.max(distance, maxDim))
      this.orthoSize = Math.max(maxDim * padding, 0.5)
      this.syncOrthoFrustum()
      this._camera.lookAt(center)
    }

    this.orbit.update()
    this.handleOrbitChange()
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
    const entry = await this.getGltfSource(url)
    entry.refs++
    const scene = cloneGltfGraph(entry.scene)
    scene.traverse(child => {
      child.userData.gltfShared = true
    })
    scene.userData.gltfShared = true
    scene.userData.gltfCacheUrl = url
    return { scene }
  }

  /** 节点移除时释放一次引用；引用归零才 dispose 共享几何 */
  releaseGltfFrom(root: THREE.Object3D): void {
    const urls: string[] = []
    const collect = (obj: THREE.Object3D) => {
      if (typeof obj.userData.gltfCacheUrl === 'string') {
        urls.push(obj.userData.gltfCacheUrl)
      }
    }
    collect(root)
    root.traverse(child => {
      if (child !== root) collect(child)
    })
    urls.forEach(u => this.releaseGLTF(u))
  }

  private releaseGLTF(url: string): void {
    const entry = this.gltfSources.get(url)
    if (!entry) return
    entry.refs = Math.max(0, entry.refs - 1)
    if (entry.refs > 0) return
    disposeObject3D(entry.scene)
    this.gltfSources.delete(url)
  }

  private async getGltfSource(url: string): Promise<{ scene: THREE.Object3D; refs: number }> {
    const hit = this.gltfSources.get(url)
    if (hit) return hit
    let pending = this.gltfLoading.get(url)
    if (!pending) {
      pending = new GLTFLoader().loadAsync(url).then(gltf => gltf.scene)
      this.gltfLoading.set(url, pending)
    }
    try {
      const scene = await pending
      const existing = this.gltfSources.get(url)
      if (existing) return existing
      const entry = { scene, refs: 0 }
      this.gltfSources.set(url, entry)
      return entry
    } finally {
      this.gltfLoading.delete(url)
    }
  }

  dispose(): void {
    window.removeEventListener('resize', this.handleResize)
    const dom = this.renderer.domElement
    if (this.viewGizmoEnabled) {
      dom.removeEventListener('pointerdown', this.handleGizmoPointerDown, true)
      window.removeEventListener('pointermove', this.handleGizmoPointerMove)
      window.removeEventListener('pointerup', this.handleGizmoPointerUp)
      window.removeEventListener('pointercancel', this.handleGizmoPointerUp)
    }
    this.viewGizmo.dispose()
    this.perfStats.dispose()
    this.gizmoPointer = null
    this.orbit.removeEventListener('change', this.handleOrbitChange)
    if (this.transform) {
      this.transform.removeEventListener('dragging-changed', this.handleDraggingChanged)
      this.transform.removeEventListener('objectChange', this.handleTransformObjectChange)
      this.transform.dispose()
    }
    this.stopLoop()
    this.orbit.dispose()
    this.gltfSources.forEach(entry => disposeObject3D(entry.scene))
    this.gltfSources.clear()
    this.gltfLoading.clear()
    this.renderer.dispose()
    this.renderer.domElement.remove()
    this.transformEndHandlers.clear()
    this.cameraPoseHandlers.clear()
    this.frameHandlers.clear()
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
      const nowMs = performance.now()
      if (this.frameHandlers.size > 0) {
        this.frameHandlers.forEach(handler => handler(nowMs))
      }
      this.orbit.update()
      const t0 = performance.now()
      this.renderer.render(this.scene, this._camera)
      if (this.viewGizmoEnabled) {
        this.viewGizmo.syncFromCamera(this._camera, this.orbit.target)
        this.viewGizmo.render(this.renderer)
      }
      const renderMs = performance.now() - t0
      this.perfStats.update(this.renderer, renderMs)
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
    // 松手后再刷一次，覆盖仅改 visible/同步路径漏标的情况
    this.markShadowNeedsUpdate()
  }

  private handleTransformObjectChange = (): void => {
    this.markShadowNeedsUpdate()
  }

  private handleGizmoPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return
    const rect = this.domElement.getBoundingClientRect()
    if (!this.viewGizmo.containsClientPoint(event.clientX, event.clientY, rect)) return

    event.preventDefault()
    event.stopPropagation()
    const hit = this.viewGizmo.pickAxis(event.clientX, event.clientY, rect)
    this.gizmoPointer = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      hit,
      dragged: false,
      orbitWasEnabled: this.orbit.enabled
    }
    this.orbit.enabled = false
    try {
      this.domElement.setPointerCapture(event.pointerId)
    } catch {
      /* ignore */
    }
  }

  private handleGizmoPointerMove = (event: PointerEvent): void => {
    const state = this.gizmoPointer
    if (!state || state.pointerId !== event.pointerId) return

    const dx = event.clientX - state.lastX
    const dy = event.clientY - state.lastY
    state.lastX = event.clientX
    state.lastY = event.clientY

    const total = Math.hypot(event.clientX - state.startX, event.clientY - state.startY)
    if (!state.dragged && total < 4) return
    state.dragged = true

    this.orbitCameraByDelta(dx, dy)
  }

  private handleGizmoPointerUp = (event: PointerEvent): void => {
    const state = this.gizmoPointer
    if (!state || state.pointerId !== event.pointerId) return

    if (!state.dragged && state.hit) {
      this.snapCameraToAxis(state.hit)
    }

    this.orbit.enabled = state.orbitWasEnabled
    this.gizmoPointer = null
    try {
      this.domElement.releasePointerCapture(event.pointerId)
    } catch {
      /* ignore */
    }
  }

  private snapCameraToAxis(hit: AxisHit): void {
    const target: [number, number, number] = [
      this.orbit.target.x,
      this.orbit.target.y,
      this.orbit.target.z
    ]
    const radius = this._camera.position.distanceTo(this.orbit.target) || 1
    const pose = cameraPoseAlongAxis(target, radius, hit.axis, hit.sign)
    this._camera.up.set(pose.up[0], pose.up[1], pose.up[2])
    this._camera.position.set(pose.position[0], pose.position[1], pose.position[2])
    this._camera.lookAt(this.orbit.target)
    this.orbit.update()
    this.handleOrbitChange()
  }

  private orbitCameraByDelta(dx: number, dy: number): void {
    const target = this.orbit.target
    // 与 OrbitControls 一致：先把 offset 变到 Y-up 球坐标，再变回 camera.up
    this.quat.setFromUnitVectors(this._camera.up, this.yAxis)
    this.quatInverse.copy(this.quat).invert()
    this.offset.copy(this._camera.position).sub(target)
    this.offset.applyQuaternion(this.quat)
    this.spherical.setFromVector3(this.offset)
    const rotSpeed = 0.005
    this.spherical.theta -= dx * rotSpeed
    this.spherical.phi -= dy * rotSpeed
    const eps = 1e-4
    this.spherical.phi = Math.max(eps, Math.min(Math.PI - eps, this.spherical.phi))
    this.offset.setFromSpherical(this.spherical)
    this.offset.applyQuaternion(this.quatInverse)
    this._camera.position.copy(target).add(this.offset)
    this._camera.lookAt(target)
    this.orbit.update()
    this.handleOrbitChange()
  }
}

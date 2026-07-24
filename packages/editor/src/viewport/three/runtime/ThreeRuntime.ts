import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

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

export interface ThreeRuntimeOptions {
  container: HTMLElement
  /** false 时不创建 gizmo（只读预览） */
  enableTransform?: boolean
}

/**
 * editor 内自维护的精简 3D 管线（渲染 / 相机 / orbit / gizmo / 拾取 / GLTF）。
 */
export class ThreeRuntime {
  public readonly scene: THREE.Scene
  public readonly camera: THREE.PerspectiveCamera
  public readonly renderer: THREE.WebGLRenderer
  public readonly orbit: OrbitControls
  public readonly transform: TransformControls | null

  private container: HTMLElement
  private loopId: number | null = null
  private lastTime = 0
  private transformBefore?: TransformSnapshot
  private transformEndHandlers = new Set<TransformEndHandler>()
  private raycaster = new THREE.Raycaster()
  private pointer = new THREE.Vector2()

  constructor(options: ThreeRuntimeOptions) {
    this.container = options.container
    this.scene = new THREE.Scene()

    const aspect = options.container.clientWidth / Math.max(options.container.clientHeight, 1) || 1
    this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 2000)
    this.camera.position.set(0, 5, 10)

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, logarithmicDepthBuffer: true })
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.setSize(options.container.clientWidth, options.container.clientHeight)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    options.container.appendChild(this.renderer.domElement)

    this.orbit = new OrbitControls(this.camera, this.renderer.domElement)
    this.orbit.enableDamping = true
    this.orbit.dampingFactor = 0.05

    if (options.enableTransform !== false) {
      this.transform = new TransformControls(this.camera, this.renderer.domElement)
      this.transform.setMode('translate')
      this.transform.addEventListener('dragging-changed', this.handleDraggingChanged)
      this.scene.add(this.transform)
    } else {
      this.transform = null
    }

    window.addEventListener('resize', this.handleResize)
    this.handleResize()
    this.startLoop()
  }

  get domElement(): HTMLCanvasElement {
    return this.renderer.domElement
  }

  onTransformEnd(handler: TransformEndHandler): () => void {
    this.transformEndHandlers.add(handler)
    return () => this.transformEndHandlers.delete(handler)
  }

  attachTransform(object: THREE.Object3D | null): void {
    if (!this.transform) return
    if (object) this.transform.attach(object)
    else this.transform.detach()
  }

  getAttachedObject(): THREE.Object3D | null {
    return (this.transform?.object as THREE.Object3D | undefined) ?? null
  }

  pick(
    clientX: number,
    clientY: number,
    objects: THREE.Object3D[]
  ): { object: THREE.Object3D | null; point?: THREE.Vector3 } {
    const { width, height, left, top } = this.domElement.getBoundingClientRect()
    this.pointer.x = ((clientX - left) / width) * 2 - 1
    this.pointer.y = -((clientY - top) / height) * 2 + 1
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const hits = this.raycaster.intersectObjects(objects, true)
    const valid = hits.find(hit => !hit.object.userData.nonSelectable)
    if (!valid) return { object: null }
    return { object: valid.object, point: valid.point }
  }

  async loadGLTF(url: string): Promise<{ scene: THREE.Group | THREE.Object3D }> {
    const loader = new GLTFLoader()
    const gltf = await loader.loadAsync(url)
    return { scene: gltf.scene }
  }

  dispose(): void {
    window.removeEventListener('resize', this.handleResize)
    if (this.transform) {
      this.transform.removeEventListener('dragging-changed', this.handleDraggingChanged)
      this.transform.dispose()
    }
    this.stopLoop()
    this.orbit.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
    this.transformEndHandlers.clear()
  }

  private startLoop(): void {
    const step = (time: number) => {
      const delta = this.lastTime ? (time - this.lastTime) / 1000 : 0
      this.lastTime = time
      void delta
      this.orbit.update()
      this.renderer.render(this.scene, this.camera)
      this.loopId = requestAnimationFrame(step)
    }
    this.loopId = requestAnimationFrame(step)
  }

  private stopLoop(): void {
    if (this.loopId !== null) {
      cancelAnimationFrame(this.loopId)
      this.loopId = null
      this.lastTime = 0
    }
  }

  private handleResize = (): void => {
    const width = this.container.clientWidth
    const height = Math.max(this.container.clientHeight, 1)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
  }

  private captureTransform(object: THREE.Object3D): TransformSnapshot {
    return {
      position: object.position.toArray() as [number, number, number],
      rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
      scale: object.scale.toArray() as [number, number, number]
    }
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

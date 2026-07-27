import * as THREE from 'three'
import type { CatalogItem, CatalogProvider, Model3DSpec } from '../../catalog/types'
import { catalogKey, isDocumentItem } from '../../catalog/types'
import type { TransformMode } from '../../core/types'
import type { EditorDocument } from '../../document/EditorDocument'
import type {
  DefaultViewJSON,
  EditorDocumentJSON,
  EditorNodeJSON,
  TransformJSON,
  VisualState,
  WallJSON
} from '../../document/types'
import { ThreeRuntime } from './runtime/ThreeRuntime'
import { EnvironmentService } from './services/environment'
import { SelectionService } from './services/selection'
import { createTransformBridge } from './services/transform-bridge'
import { findClosedWallLoops } from '../canvas2d/utils/closed-loops'

export interface Viewport3DOptions {
  document: EditorDocument
  catalog?: CatalogProvider
  /** 只读预览：无 gizmo、不写 document；点击经 onNodeClick 通知 Host */
  readonly?: boolean
  onNodeClick?: (nodePath: string, node: EditorNodeJSON | undefined) => void
  transformModes?: TransformMode[]
  transformMode?: TransformMode
  snapEnabled?: boolean
}

/** 嵌套解析深度上限（D2：场景→柜→元件） */
const MAX_RESOLVE_DEPTH = 2

const STATUS_COLORS: Record<Exclude<VisualState['status'], 'normal'>, number> = {
  warning: 0xf5a623,
  fault: 0xff4d4f,
  offline: 0x8c8c8c
}

interface MaterialBackup {
  emissive?: THREE.Color
  emissiveIntensity?: number
}

/**
 * 3D 视图：Document 的三维投影。
 * - ThreeRuntime（渲染循环 / 相机 / gizmo / 拾取）
 * - nodeId ↔ Object3D 双向映射（D1）
 * - document 型 Catalog 条目嵌套解析（D2）
 * - setNodeVisualState 路径寻址（监控预览）
 */
export class Viewport3D {
  public readonly runtime: ThreeRuntime

  private doc: EditorDocument
  private catalog?: CatalogProvider
  private readonly readonly: boolean
  private onNodeClick?: Viewport3DOptions['onNodeClick']

  private nodeRoots = new Map<string, THREE.Object3D>()
  private pathObjects = new Map<string, THREE.Object3D>()
  private wallGroup = new THREE.Group()
  private floorGroup = new THREE.Group()
  private envGroup = new THREE.Group()
  private itemCache = new Map<string, CatalogItem>()
  private unsubscribers: Array<() => void> = []
  private disposed = false
  private visualStates = new Map<string, VisualState>()
  private selection: SelectionService
  private environment: EnvironmentService
  /** 上次已写入的位姿键；仅 type/position/target 变化时才重置 Orbit */
  private lastCameraPoseKey: string | null = null

  constructor(container: HTMLElement, options: Viewport3DOptions) {
    this.doc = options.document
    this.catalog = options.catalog ?? options.document.getCatalog()
    this.readonly = options.readonly ?? false
    this.onNodeClick = options.onNodeClick

    this.runtime = new ThreeRuntime({
      container,
      enableTransform: !this.readonly,
      transformMode: options.transformMode ?? 'translate'
    })
    if (!this.readonly) {
      this.runtime.setAllowedModes(options.transformModes ?? ['translate'])
      this.runtime.setMode(options.transformMode ?? 'translate')
      // 会话吸附是 2D 贴边对齐；3D gizmo 不做硬网格，避免一格一格跳
      this.runtime.setTranslationSnap(false)
    }

    this.envGroup.name = '__editorEnv__'
    this.wallGroup.name = '__editorWalls__'
    this.floorGroup.name = '__editorFloors__'
    this.markNonSelectable(this.floorGroup)
    this.runtime.scene.add(this.envGroup)
    this.runtime.scene.add(this.floorGroup)
    this.runtime.scene.add(this.wallGroup)

    this.environment = new EnvironmentService({
      runtime: this.runtime,
      envGroup: this.envGroup
    })
    this.applyCameraFromEnvironment()
    void this.environment.apply(this.doc.environment, this.doc.bounds)

    this.rebuildWalls()
    void this.buildAllNodes()

    this.selection = new SelectionService({
      doc: this.doc,
      runtime: this.runtime,
      readonly: this.readonly,
      nodeRoots: this.nodeRoots,
      onNodeClick: this.onNodeClick
    })

    const onTransformEnd = createTransformBridge({
      doc: this.doc,
      runtime: this.runtime,
      applyTransformToObject: (object, transform) => this.applyTransformToObject(object, transform)
    })

    // document → 3D
    this.unsubscribers.push(
      this.doc.on('node:added', ({ node }) => {
        void this.buildNode(node)
      }),
      this.doc.on('node:removed', ({ node }) => {
        this.removeNodeObject(node.id)
      }),
      this.doc.on('node:updated', ({ node }) => {
        this.syncNodeObject(node)
      }),
      this.doc.on('wall:added', () => this.rebuildWalls()),
      this.doc.on('wall:removed', () => this.rebuildWalls()),
      this.doc.on('wall:updated', () => this.rebuildWalls()),
      this.doc.on('bounds:updated', () => {
        void this.environment.apply(this.doc.environment, this.doc.bounds)
      }),
      this.doc.on('environment:updated', ({ environment }) => {
        void this.environment.apply(environment, this.doc.bounds)
        this.applyCameraFromEnvironment()
      }),
      this.doc.on('selection:changed', ({ ids }) => this.selection.syncGizmo(ids)),
      this.runtime.onTransformEnd(onTransformEnd)
    )

    const dom = this.runtime.domElement
    dom.addEventListener('pointerdown', this.selection.handlePointerDown)
    dom.addEventListener('pointerup', this.selection.handlePointerUp)
  }

  // -- 环境 / 相机 -------------------------------------------------------------

  private markNonSelectable(object: THREE.Object3D): void {
    object.traverse(child => {
      child.userData.nonSelectable = true
    })
    object.userData.nonSelectable = true
  }

  /** Document.defaultView → 相机；位姿未变时只更新投影/距离限制 */
  private applyCameraFromEnvironment(): void {
    const view = this.doc.environment.defaultView ?? this.fallbackDefaultView()
    const type = view.type === 'orthographic' ? 'orthographic' : 'orbit'
    const poseKey = `${type}|${view.position.join(',')}|${view.target.join(',')}`
    const poseChanged = this.lastCameraPoseKey !== poseKey
    const applyPose =
      this.lastCameraPoseKey === null ||
      (poseChanged && !this.runtime.poseNear(view.position, view.target))

    this.runtime.applyDefaultView(view, { applyPose })
    this.lastCameraPoseKey = poseKey
  }

  private fallbackDefaultView(): DefaultViewJSON {
    const { width, depth, height } = this.doc.bounds
    if (this.doc.kind === 'container') {
      const h = height ?? 2
      return {
        type: 'orbit',
        position: [0, h * 0.45, Math.max(depth, 0.6) * 2.2],
        target: [0, h * 0.45, 0],
        fov: 50
      }
    }
    const d = Math.max(width, depth, 4)
    return {
      type: 'orbit',
      position: [d * 0.65, d * 0.6, d * 0.95],
      target: [0, 0, 0],
      fov: 50
    }
  }

  private rebuildWalls(): void {
    this.wallGroup.clear()
    this.floorGroup.clear()
    this.doc.getWalls().forEach(wall => {
      const mesh = this.buildWallMesh(wall)
      this.wallGroup.add(mesh)
    })
    this.rebuildFloors()
    this.markNonSelectable(this.wallGroup)
    this.wallGroup.traverse(child => {
      child.raycast = () => {}
    })
  }

  private rebuildFloors(): void {
    const loops = findClosedWallLoops(this.doc.getWalls())
    loops.forEach(loop => {
      if (loop.points.length < 3) return
      const shape = new THREE.Shape()
      shape.moveTo(loop.points[0].u, -loop.points[0].v)
      for (let i = 1; i < loop.points.length; i++) {
        shape.lineTo(loop.points[i].u, -loop.points[i].v)
      }
      shape.closePath()
      const geom = new THREE.ShapeGeometry(shape)
      const mesh = new THREE.Mesh(
        geom,
        new THREE.MeshStandardMaterial({
          color: '#1a3048',
          roughness: 0.95,
          metalness: 0.05,
          side: THREE.DoubleSide
        })
      )
      // Shape 在 XY；转到 XZ 地面（y 向上）
      mesh.rotation.x = -Math.PI / 2
      mesh.position.y = 0.01
      mesh.receiveShadow = true
      mesh.userData.nonSelectable = true
      this.floorGroup.add(mesh)
    })
    this.markNonSelectable(this.floorGroup)
    this.floorGroup.traverse(child => {
      child.raycast = () => {}
    })
  }

  private buildWallMesh(wall: WallJSON): THREE.Mesh {
    const length = Math.hypot(wall.b[0] - wall.a[0], wall.b[1] - wall.a[1])
    const height = wall.height ?? 3
    const thickness = wall.thickness ?? 0.2
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(length, 0.01), height, thickness),
      new THREE.MeshStandardMaterial({ color: '#233242', roughness: 0.85, transparent: true, opacity: 0.92 })
    )
    mesh.position.set((wall.a[0] + wall.b[0]) / 2, height / 2, (wall.a[1] + wall.b[1]) / 2)
    mesh.rotation.y = -Math.atan2(wall.b[1] - wall.a[1], wall.b[0] - wall.a[0])
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
  }

  // -- Catalog --------------------------------------------------------------

  private async resolveItem(id: string, version: string): Promise<CatalogItem | undefined> {
    const key = catalogKey(id, version)
    if (this.itemCache.has(key)) return this.itemCache.get(key)
    const item = (await this.catalog?.get(id, version)) ?? undefined
    if (item) {
      this.itemCache.set(key, item)
      this.doc.cacheItem(item)
    }
    return item
  }

  private async resolveItemDocument(item: CatalogItem): Promise<EditorDocumentJSON | undefined> {
    if (item.document) return item.document
    if (item.documentUrl) {
      const response = await fetch(item.documentUrl)
      return (await response.json()) as EditorDocumentJSON
    }
    return undefined
  }

  // -- 节点构建（含 D2 嵌套解析） ------------------------------------------------

  private async buildAllNodes(): Promise<void> {
    for (const node of this.doc.getNodes()) {
      await this.buildNode(node)
    }
  }

  private async buildNode(node: EditorNodeJSON): Promise<void> {
    if (this.disposed) return
    this.removeNodeObject(node.id)

    const root = new THREE.Group()
    root.name = node.name ?? node.id
    root.userData.nodePath = node.id

    const content = await this.buildNodeContent(node, node.id, 0)
    if (content) root.add(content)

    this.applyTransformToObject(root, node.transform)
    root.visible = node.visible !== false

    if (this.disposed) return
    this.nodeRoots.set(node.id, root)
    this.pathObjects.set(node.id, root)
    this.runtime.scene.add(root)

    // 恢复可能已设置的可视状态
    this.visualStates.forEach((state, path) => {
      if (path === node.id || path.startsWith(`${node.id}/`)) {
        this.applyVisualState(path, state)
      }
    })
  }

  private async buildNodeContent(
    node: EditorNodeJSON,
    path: string,
    depth: number
  ): Promise<THREE.Object3D | undefined> {
    if (!node.catalogRef) {
      return this.buildFallbackMesh(undefined)
    }
    const item = await this.resolveItem(node.catalogRef.id, node.catalogRef.version)
    if (!item) {
      return this.buildFallbackMesh(undefined)
    }

    if (isDocumentItem(item)) {
      if (depth >= MAX_RESOLVE_DEPTH) {
        console.warn(`[viewport3d] nested document depth limit reached at "${path}"`)
        return this.buildFootprintBox(item)
      }
      return this.buildDocumentItem(item, path, depth)
    }

    if (item.model3d) {
      return this.buildModel(item.model3d, item)
    }
    return this.buildFootprintBox(item)
  }

  /** document 型条目：递归实例化内部节点，子对象路径为 `${path}/${childId}` */
  private async buildDocumentItem(item: CatalogItem, path: string, depth: number): Promise<THREE.Object3D> {
    const group = new THREE.Group()
    group.name = `${item.name}(document)`

    if (item.shell3d) {
      const shell = await this.buildModel(item.shell3d, item)
      shell.userData.isShell = true
      // 外壳半透明，保证柜内元件可见、可高亮
      shell.traverse(child => {
        child.userData.isShell = true
        const mesh = child as THREE.Mesh
        if (mesh.isMesh) {
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
          materials.forEach(mat => {
            mat.transparent = true
            mat.opacity = 0.28
            mat.depthWrite = false
          })
        }
      })
      group.add(shell)
    }

    const json = await this.resolveItemDocument(item)
    if (!json) {
      group.add(this.buildFootprintBox(item))
      return group
    }
    if (json.kind !== 'container') {
      console.warn(`[viewport3d] document item "${item.id}" is not a container, skip nesting`)
      group.add(this.buildFootprintBox(item))
      return group
    }

    for (const child of json.nodes ?? []) {
      const childPath = `${path}/${child.id}`
      const childObject = new THREE.Group()
      childObject.name = child.name ?? child.id
      childObject.userData.nodePath = childPath
      const content = await this.buildNodeContent(child, childPath, depth + 1)
      if (content) childObject.add(content)
      this.applyTransformToObject(childObject, child.transform)
      childObject.visible = child.visible !== false
      group.add(childObject)
      this.pathObjects.set(childPath, childObject)
    }
    return group
  }

  private async buildModel(spec: Model3DSpec, item: CatalogItem): Promise<THREE.Object3D> {
    if (spec.type === 'gltf') {
      try {
        const result = await this.runtime.loadGLTF(spec.url)
        result.scene.traverse(child => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true
            child.receiveShadow = true
          }
        })
        return result.scene
      } catch (error) {
        console.warn(`[viewport3d] failed to load gltf "${spec.url}"`, error)
        return this.buildFootprintBox(item)
      }
    }
    const [w, h, d] = spec.size
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color: spec.color ?? '#4da3ff', roughness: 0.55, metalness: 0.25 })
    )
    mesh.position.y = h / 2
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
  }

  private buildFootprintBox(item?: CatalogItem): THREE.Object3D {
    const w = item?.footprint.width ?? 1
    const d = item?.footprint.depth ?? 1
    const h = item?.footprint.height ?? 1
    const color = typeof item?.thumb === 'string' && item.thumb.startsWith('#') ? item.thumb : '#5a7a9a'
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.1 })
    )
    mesh.position.y = h / 2
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
  }

  private buildFallbackMesh(item?: CatalogItem): THREE.Object3D {
    return this.buildFootprintBox(item)
  }

  private removeNodeObject(id: string): void {
    const root = this.nodeRoots.get(id)
    if (!root) return
    if (this.runtime.getAttachedObject() === root) {
      this.runtime.attachTransform(null)
    }
    this.runtime.scene.remove(root)
    this.nodeRoots.delete(id)
    Array.from(this.pathObjects.keys())
      .filter(path => path === id || path.startsWith(`${id}/`))
      .forEach(path => this.pathObjects.delete(path))
    root.traverse(child => {
      const mesh = child as THREE.Mesh
      if (mesh.isMesh) {
        mesh.geometry?.dispose()
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        materials.forEach(mat => mat?.dispose())
      }
    })
  }

  private syncNodeObject(node: EditorNodeJSON): void {
    const root = this.nodeRoots.get(node.id)
    if (!root) return
    this.applyTransformToObject(root, node.transform)
    root.visible = node.visible !== false
    // 隐藏时立刻卸掉 gizmo（visible 变更不会走 selection:changed）
    if (node.visible === false && this.doc.selection.first() === node.id) {
      this.selection.syncGizmo([])
    } else if (node.visible !== false && this.doc.selection.first() === node.id) {
      this.selection.syncGizmo([node.id])
    }
  }

  private applyTransformToObject(object: THREE.Object3D, transform: TransformJSON): void {
    object.position.fromArray(transform.position)
    object.rotation.set(transform.rotation[0], transform.rotation[1], transform.rotation[2])
    object.scale.fromArray(transform.scale)
  }

  // -- 会话交互 ----------------------------------------------------------------

  setSnapEnabled(_enabled: boolean): void {
    if (this.readonly) return
    // 2D 贴边由 Viewport2D 处理；3D 保持连续拖拽
    this.runtime.setTranslationSnap(false)
  }

  setTransformModes(modes: TransformMode[]): void {
    if (this.readonly) return
    this.runtime.setAllowedModes(modes)
  }

  setTransformMode(mode: TransformMode): void {
    if (this.readonly) return
    this.runtime.setMode(mode)
  }

  // -- 运行时可视状态（监控预览） --------------------------------------------------

  /**
   * 路径寻址：顶层节点为 nodeId；柜内元件为 `${sceneNodeId}/${childNodeId}`。
   */
  setNodeVisualState(nodePath: string, state: VisualState): void {
    this.visualStates.set(nodePath, state)
    this.applyVisualState(nodePath, state)
  }

  clearVisualStates(): void {
    Array.from(this.visualStates.keys()).forEach(path => {
      this.applyVisualState(path, { status: 'normal' })
    })
    this.visualStates.clear()
  }

  private applyVisualState(nodePath: string, state: VisualState): void {
    const object = this.pathObjects.get(nodePath)
    if (!object) return
    const intensity = state.intensity ?? 1

    object.traverse(child => {
      const mesh = child as THREE.Mesh
      if (!mesh.isMesh || mesh.userData.isShell) return
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      materials.forEach((mat, index) => {
        const std = mat as THREE.MeshStandardMaterial
        if (!std || !('emissive' in std)) return
        // 首次修改前克隆，避免污染共享材质
        if (!mesh.userData.__ownMaterial) {
          const cloned = materials.map(m => m.clone())
          mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0]
          mesh.userData.__ownMaterial = true
          mesh.userData.__origEmissive = cloned.map(m => ({
            emissive: (m as THREE.MeshStandardMaterial).emissive?.clone(),
            emissiveIntensity: (m as THREE.MeshStandardMaterial).emissiveIntensity
          }))
        }
        const current = (Array.isArray(mesh.material) ? mesh.material : [mesh.material])[
          index
        ] as THREE.MeshStandardMaterial
        const backups = mesh.userData.__origEmissive as MaterialBackup[] | undefined

        if (state.status === 'normal') {
          const backup = backups?.[index]
          if (backup?.emissive) current.emissive.copy(backup.emissive)
          else current.emissive.setHex(0x000000)
          current.emissiveIntensity = backup?.emissiveIntensity ?? 1
        } else {
          current.emissive.setHex(STATUS_COLORS[state.status])
          current.emissiveIntensity = 0.6 * intensity + 0.2
        }
      })
    })
  }

  // -- 生命周期 -----------------------------------------------------------------

  /** Orbit 交互位姿变化（滚轮/右键平移/旋转等） */
  onCameraPoseChange(handler: (pose: {
    position: [number, number, number]
    target: [number, number, number]
    radius: number
  }) => void): () => void {
    return this.runtime.onCameraPoseChange(handler)
  }

  dispose(): void {
    this.disposed = true
    this.unsubscribers.forEach(off => off())
    const dom = this.runtime.domElement
    dom.removeEventListener('pointerdown', this.selection.handlePointerDown)
    dom.removeEventListener('pointerup', this.selection.handlePointerUp)
    Array.from(this.nodeRoots.keys()).forEach(id => this.removeNodeObject(id))
    this.environment.dispose()
    this.runtime.dispose()
  }
}

export function create3DViewport(container: HTMLElement, options: Viewport3DOptions): Viewport3D {
  return new Viewport3D(container, options)
}

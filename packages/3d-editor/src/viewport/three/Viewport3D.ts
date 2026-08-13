import * as THREE from 'three'
import type { CatalogItem, CatalogProvider, Model3DSpec, ProceduralModelResolver } from '../../catalog/types'
import { catalogKey, isDocumentItem } from '../../catalog/types'
import type { TransformMode } from '../../core/types'
import type { EditorDocument } from '../../document/EditorDocument'
import type {
  CameraViewType,
  DefaultViewJSON,
  EditorDocumentJSON,
  EditorNodeJSON,
  EnvironmentJSON,
  TransformJSON,
  VisualState,
  WallJSON
} from '../../document/types'
import { ThreeRuntime } from './runtime/ThreeRuntime'
import { EnvironmentService } from './services/environment'
import { SelectionService } from './services/selection'
import { HoverHighlight } from './services/hover-highlight'
import {
  createCeilingMaterial,
  createFloorMaterial,
  createRoomCeilingMesh,
  createRoomFloorMesh,
  createSiteCeilingMesh,
  createSiteFloorMesh,
  type FloorMaterialHandle
} from './helpers/floor'
import {
  createWallMaterial,
  scaleWallBoxUVs,
  type WallMaterialHandle
} from './helpers/wall-material'
import { buildEnclosure } from './helpers/enclosure'
import { instantiateProceduralModule } from './services/procedural-module-loader'
import { findClosedWallLoops } from '../canvas2d/utils/closed-loops'
import type { NodeInteractionHandler } from '../interaction-events'
import { findNodePath, isObjectUnder } from './utils/node-path'
import {
  createIndoorDefaultView,
  type CreateIndoorDefaultViewOptions
} from './utils/indoor-view'
import { cloneEnvironment } from '../../document/defaults'

export interface Viewport3DOptions {
  document: EditorDocument
  catalog?: CatalogProvider
  /** 只读预览：无 gizmo、不写 document；交互经 onInteraction 通知 Host */
  readonly?: boolean
  onInteraction?: NodeInteractionHandler
  transformModes?: TransformMode[]
  transformMode?: TransformMode
  snapEnabled?: boolean
  /** 左下角性能 Info；默认 false */
  perfStats?: boolean
  /** 悬停描边；默认 true */
  hoverOutline?: boolean
  /** Host 程序化模型解析（model3d.type === 'procedural'） */
  proceduralResolve?: ProceduralModelResolver
}

export interface FocusCameraOptions {
  /** 框住包围盒的余量倍数；默认 1.4 */
  padding?: number
}

export type EnterIndoorViewOptions = CreateIndoorDefaultViewOptions & {
  /** 是否写回 document.environment.defaultView；默认 false */
  persist?: boolean
}

/** 嵌套解析深度上限（D2：场景→柜→元件） */
const MAX_RESOLVE_DEPTH = 2

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
  private onInteraction?: NodeInteractionHandler
  private proceduralResolve?: ProceduralModelResolver

  private nodeRoots = new Map<string, THREE.Object3D>()
  private pathObjects = new Map<string, THREE.Object3D>()
  private wallGroup = new THREE.Group()
  private floorGroup = new THREE.Group()
  private ceilingGroup = new THREE.Group()
  private envGroup = new THREE.Group()
  private itemCache = new Map<string, CatalogItem>()
  private unsubscribers: Array<() => void> = []
  private disposed = false
  private visualStates = new Map<string, VisualState>()
  private selection: SelectionService
  private hoverHighlight: HoverHighlight
  private environment: EnvironmentService
  /** 上次已写入的位姿键；仅 type/position/target 变化时才重置 Orbit */
  private lastCameraPoseKey: string | null = null
  private floorMaterialHandle: FloorMaterialHandle | null = null
  private floorApplyToken = 0
  private ceilingMaterialHandle: FloorMaterialHandle | null = null
  private ceilingApplyToken = 0
  private wallMaterialHandle: WallMaterialHandle | null = null
  private wallApplyToken = 0
  /** 墙/地/天花相关 env 快照；仅变化时才 rebuild，避免开关网格整屏闪 */
  private lastShellEnvKey: string | null = null

  constructor(container: HTMLElement, options: Viewport3DOptions) {
    this.doc = options.document
    this.catalog = options.catalog ?? options.document.getCatalog()
    this.readonly = options.readonly ?? false
    this.onInteraction = options.onInteraction
    this.proceduralResolve = options.proceduralResolve

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
    if (options.perfStats) this.runtime.setPerfStatsVisible(true)

    this.envGroup.name = '__editorEnv__'
    this.wallGroup.name = '__editorWalls__'
    this.floorGroup.name = '__editorFloors__'
    this.ceilingGroup.name = '__editorCeilings__'
    this.markNonSelectable(this.floorGroup)
    this.markNonSelectable(this.ceilingGroup)
    this.runtime.scene.add(this.envGroup)
    this.runtime.scene.add(this.floorGroup)
    this.runtime.scene.add(this.ceilingGroup)
    this.runtime.scene.add(this.wallGroup)

    this.environment = new EnvironmentService({
      runtime: this.runtime,
      envGroup: this.envGroup,
      resolveEnclosure: this.proceduralResolve
        ? async (kind, size) => {
            if (kind !== 'outdoorCabinet' || !this.proceduralResolve) return null
            const item: CatalogItem = {
              id: '__enclosure-outdoorCabinet__',
              version: '0',
              name: 'outdoorCabinet',
              placeableIn: ['container'],
              footprint: {
                width: size.width,
                depth: size.depth,
                height: size.height,
              },
            }
            const built = await this.proceduralResolve(
              { id: 'outdoor-cabinet' },
              { item, THREE }
            )
            return built ?? null
          }
        : undefined
    })
    this.applyCameraFromEnvironment()
    void this.environment.apply(this.doc.environment, this.doc.bounds)
    this.lastShellEnvKey = shellEnvKey(this.doc.environment)

    void this.rebuildWalls()
    void this.buildAllNodes()

    this.hoverHighlight = new HoverHighlight(this.runtime.renderer)
    const hoverOutline = options.hoverOutline ?? false
    this.selection = new SelectionService({
      doc: this.doc,
      runtime: this.runtime,
      readonly: this.readonly,
      nodeRoots: this.nodeRoots,
      pathObjects: this.pathObjects,
      hoverOutline,
      hoverHighlight: this.hoverHighlight,
      onInteraction: this.onInteraction
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
      this.doc.on('wall:added', () => void this.rebuildWalls()),
      this.doc.on('wall:removed', () => void this.rebuildWalls()),
      this.doc.on('wall:updated', () => void this.rebuildWalls()),
      this.doc.on('bounds:updated', () => {
        void this.environment.apply(this.doc.environment, this.doc.bounds)
        this.lastShellEnvKey = shellEnvKey(this.doc.environment)
        void this.rebuildWalls()
      }),
      this.doc.on('environment:updated', ({ environment }) => {
        void this.environment.apply(environment, this.doc.bounds)
        this.applyCameraFromEnvironment()
        const shellKey = shellEnvKey(environment)
        if (shellKey !== this.lastShellEnvKey) {
          this.lastShellEnvKey = shellKey
          void this.rebuildWalls()
        }
      }),
      this.doc.on('selection:changed', ({ ids }) => this.selection.syncGizmo(ids)),
      this.runtime.onTransformEnd(({ id }) => {
        const attached = this.runtime.getAttachedObject()
        if (!attached || attached.uuid !== id) return
        const path = findNodePath(attached)
        if (!path) return
        const nodeId = path.split('/')[0]
        const node = this.doc.getNode(nodeId)
        if (!node) return
        const result = this.doc.commands.transformNode(
          nodeId,
          {
            position: [...attached.position.toArray()] as [number, number, number],
            rotation: [attached.rotation.x, attached.rotation.y, attached.rotation.z],
            scale: [...attached.scale.toArray()] as [number, number, number]
          },
          { source: 'viewport3d' }
        )
        if (!result.ok) {
          this.applyTransformToObject(attached, node.transform)
        }
      })
    )

    const dom = this.runtime.domElement
    dom.addEventListener('pointerdown', this.selection.handlePointerDown)
    dom.addEventListener('pointermove', this.selection.handlePointerMove)
    dom.addEventListener('pointerup', this.selection.handlePointerUp)
    dom.addEventListener('pointerleave', this.selection.handlePointerLeave)
    window.addEventListener('resize', this.handleHoverResize)
    this.handleHoverResize()
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

  private async rebuildWalls(): Promise<void> {
    const token = ++this.wallApplyToken
    this.wallGroup.children.forEach(child => {
      ; (child as THREE.Mesh).geometry?.dispose()
    })
    this.wallGroup.clear()
    if (this.wallMaterialHandle) {
      this.wallMaterialHandle.dispose()
      this.wallMaterialHandle = null
    }

    const handle = await createWallMaterial(this.doc.environment.wall)
    if (token !== this.wallApplyToken || this.disposed) {
      handle.dispose()
      return
    }
    this.wallMaterialHandle = handle

    this.doc.getWalls().forEach(wall => {
      const mesh = this.buildWallMesh(wall, handle.material)
      this.wallGroup.add(mesh)
    })
    void this.rebuildFloors()
    void this.rebuildCeilings()
    this.markNonSelectable(this.wallGroup)
    this.wallGroup.traverse(child => {
      child.raycast = () => { }
    })
  }

  private clearMeshGroup(
    group: THREE.Group,
    disposeHandle: (() => void) | null
  ): void {
    while (group.children.length) {
      const child = group.children[0]
      group.remove(child)
      const mesh = child as THREE.Mesh
      if (mesh.geometry) mesh.geometry.dispose()
    }
    disposeHandle?.()
  }

  private async rebuildFloors(): Promise<void> {
    const token = ++this.floorApplyToken
    this.clearMeshGroup(this.floorGroup, () => {
      this.floorMaterialHandle?.dispose()
      this.floorMaterialHandle = null
    })

    const floor = this.doc.environment.floor
    if (!floor.visible) return

    const handle = await createFloorMaterial(floor, this.doc.bounds)
    if (token !== this.floorApplyToken || this.disposed) {
      handle.dispose()
      return
    }
    this.floorMaterialHandle = handle
    const { material } = handle
    const loops = findClosedWallLoops(this.doc.getWalls())

    // bounds / closedRooms 互斥：旧逻辑在 bounds 时仍叠房间地板 → 双地 z-fight
    if (floor.coverage === 'bounds') {
      this.floorGroup.add(createSiteFloorMesh(this.doc.bounds, material))
    } else {
      loops.forEach(loop => {
        const mesh = createRoomFloorMesh(loop.points, material, this.doc.bounds)
        if (mesh) this.floorGroup.add(mesh)
      })
    }

    this.markNonSelectable(this.floorGroup)
    this.floorGroup.traverse(child => {
      child.raycast = () => { }
    })
  }

  private async rebuildCeilings(): Promise<void> {
    const token = ++this.ceilingApplyToken
    this.clearMeshGroup(this.ceilingGroup, () => {
      this.ceilingMaterialHandle?.dispose()
      this.ceilingMaterialHandle = null
    })

    const ceiling = this.doc.environment.ceiling
    if (!ceiling?.visible) return

    const height = this.doc.bounds.height ?? 3
    const handle = await createCeilingMaterial(ceiling, this.doc.bounds)
    if (token !== this.ceilingApplyToken || this.disposed) {
      handle.dispose()
      return
    }
    this.ceilingMaterialHandle = handle
    const { material } = handle
    const loops = findClosedWallLoops(this.doc.getWalls())

    if (ceiling.coverage === 'bounds') {
      this.ceilingGroup.add(createSiteCeilingMesh(this.doc.bounds, material, height))
    } else {
      loops.forEach(loop => {
        const mesh = createRoomCeilingMesh(loop.points, material, this.doc.bounds, height)
        if (mesh) this.ceilingGroup.add(mesh)
      })
    }

    this.markNonSelectable(this.ceilingGroup)
    this.ceilingGroup.traverse(child => {
      child.raycast = () => { }
    })
  }

  private buildWallMesh(
    wall: WallJSON,
    material: THREE.MeshStandardMaterial
  ): THREE.Mesh {
    const span = Math.hypot(wall.b[0] - wall.a[0], wall.b[1] - wall.a[1])
    const height = wall.height ?? this.doc.bounds.height ?? 3
    const thickness = wall.thickness ?? 0.2
    const wallEnv = this.doc.environment.wall
    // cornerOverlap：全长相交；否则两端各收半个厚度对接
    const length = wallEnv.cornerOverlap
      ? Math.max(span, 0.01)
      : Math.max(span - thickness, 0.01)
    const embed = 0.01
    const geoHeight = height + embed
    const geometry = new THREE.BoxGeometry(length, geoHeight, thickness)
    if (wallEnv.mapUrl) {
      scaleWallBoxUVs(geometry, length, geoHeight, wallEnv.mapRepeat ?? 2)
    }
    const mesh = new THREE.Mesh(geometry, material)
    // 底埋入地面；顶仍到净高
    mesh.position.set(
      (wall.a[0] + wall.b[0]) / 2,
      geoHeight / 2 - embed,
      (wall.a[1] + wall.b[1]) / 2
    )
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
      return this.buildFootprintBox(undefined)
    }
    const item = await this.resolveItem(node.catalogRef.id, node.catalogRef.version)
    if (!item) {
      return this.buildFootprintBox(undefined)
    }

    if (isDocumentItem(item)) {
      if (depth >= MAX_RESOLVE_DEPTH) {
        console.warn(`[viewport3d] nested document depth limit reached at "${path}"`)
        return this.buildFootprintBox(item)
      }
      return this.buildDocumentItem(item, path, depth)
    }

    if (item.model3d) {
      return this.buildModel(item.model3d, item, node)
    }
    return this.buildFootprintBox(item)
  }

  /** document 型条目：递归实例化内部节点，子对象路径为 `${path}/${childId}` */
  private async buildDocumentItem(item: CatalogItem, path: string, depth: number): Promise<THREE.Object3D> {
    const group = new THREE.Group()
    group.name = `${item.name}(document)`

    const json = await this.resolveItemDocument(item)
    const shell = await this.buildDocumentShell(item, json)
    if (shell) group.add(shell)

    if (!json) {
      if (!shell) group.add(this.buildFootprintBox(item))
      return group
    }
    if (json.kind !== 'container') {
      console.warn(`[viewport3d] document item "${item.id}" is not a container, skip nesting`)
      if (!shell) group.add(this.buildFootprintBox(item))
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

  /**
   * 嵌套柜外壳优先级：gltf shell3d > procedural shell3d > 内层 document.enclosure > 其它 shell3d。
   * enclosure 与资产编辑态 helpers 对齐；outdoorCabinet 可走 Host procedural。
   */
  private async buildDocumentShell(
    item: CatalogItem,
    json: EditorDocumentJSON | undefined
  ): Promise<THREE.Object3D | undefined> {
    const shell3d = item.shell3d
    if (shell3d?.type === 'gltf') {
      return this.styleAsShell(await this.buildModel(shell3d, item))
    }
    if (shell3d?.type === 'procedural') {
      return this.styleAsShell(await this.buildModel(shell3d, item))
    }

    const enclosure = json?.environment?.helpers?.enclosure
    if (enclosure && enclosure !== 'none') {
      const width = json?.bounds.width ?? item.footprint.width
      const depth = json?.bounds.depth ?? item.footprint.depth
      const height = json?.bounds.height ?? item.footprint.height ?? 2
      if (enclosure === 'outdoorCabinet' && this.proceduralResolve) {
        const enclosureItem: CatalogItem = {
          ...item,
          footprint: { width, depth, height },
        }
        try {
          const built = await this.proceduralResolve(
            { id: 'outdoor-cabinet' },
            { item: enclosureItem, THREE }
          )
          if (built) return this.styleAsShell(built)
        } catch (error) {
          console.warn('[viewport3d] outdoorCabinet host resolve failed', error)
        }
      }
      const built = buildEnclosure(enclosure, width, height, depth)
      if (built) return this.styleAsShell(built)
    }

    if (shell3d) {
      return this.styleAsShell(await this.buildModel(shell3d, item))
    }
    return undefined
  }

  /** 外壳半透明，保证柜内元件可见、可高亮 */
  private styleAsShell(shell: THREE.Object3D): THREE.Object3D {
    shell.userData.isShell = true
    shell.traverse(child => {
      child.userData.isShell = true
      const mesh = child as THREE.Mesh
      if (!mesh.isMesh) return
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      materials.forEach(mat => {
        mat.opacity = 0.88
      })
    })
    return shell
  }

  private async buildModel(
    spec: Model3DSpec,
    item: CatalogItem,
    node?: EditorNodeJSON
  ): Promise<THREE.Object3D> {
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
    if (spec.type === 'procedural') {
      if (spec.url) {
        try {
          return await instantiateProceduralModule(spec.url, THREE, {
            footprint: item.footprint,
            item
          })
        } catch (error) {
          console.warn(`[viewport3d] procedural url load failed for "${spec.url}"`, error)
          return this.buildFootprintBox(item)
        }
      }
      if (!this.proceduralResolve) {
        console.warn(
          `[viewport3d] procedural model "${spec.id}" but no procedural.resolve injected; fallback box`
        )
        return this.buildFootprintBox(item)
      }
      try {
        const built = await this.proceduralResolve({ id: spec.id }, { item, THREE, node })
        if (built) return built
        console.warn(`[viewport3d] procedural resolve returned empty for "${spec.id}"; fallback box`)
      } catch (error) {
        console.warn(`[viewport3d] procedural resolve failed for "${spec.id}"`, error)
      }
      return this.buildFootprintBox(item)
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

  setPerfStatsVisible(visible: boolean): void {
    this.runtime.setPerfStatsVisible(visible)
  }

  isPerfStatsVisible(): boolean {
    return this.runtime.isPerfStatsVisible()
  }

  setHoverOutlineEnabled(enabled: boolean): void {
    this.selection.setHoverOutlineEnabled(enabled)
  }

  /** 聚焦当前 Document 选中（取首个 id） */
  focusSelection(options?: FocusCameraOptions): void {
    const id = this.doc.selection.get()[0]
    if (!id) return
    this.focusNode(id, options)
  }

  /** 路径寻址聚焦：顶层 nodeId 或 柜/元件 */
  focusNode(nodePath: string, options?: FocusCameraOptions): void {
    const object = this.pathObjects.get(nodePath) ?? this.nodeRoots.get(nodePath)
    if (!object) return
    this.runtime.focusObject(object, options?.padding ?? 1.4)
  }

  /** Host 覆盖层 / 动态贴图：取节点根 Object3D */
  getNodeObject(nodeId: string): THREE.Object3D | undefined {
    return this.nodeRoots.get(nodeId) ?? this.pathObjects.get(nodeId)
  }

  setCameraMode(mode: CameraViewType): void {
    this.runtime.setCameraMode(mode)
  }

  getCameraMode(): CameraViewType {
    return this.runtime.getCameraMode()
  }

  /** 应用 defaultView；缺省用 document.environment.defaultView */
  applyDefaultView(view?: DefaultViewJSON, options?: { applyPose?: boolean }): void {
    const next = view ?? this.doc.environment.defaultView ?? this.fallbackDefaultView()
    const type = next.type === 'orthographic' ? 'orthographic' : 'orbit'
    const poseKey = `${type}|${next.position.join(',')}|${next.target.join(',')}`
    const applyPose = options?.applyPose ?? true
    this.runtime.applyDefaultView(next, { applyPose })
    this.lastCameraPoseKey = poseKey
  }

  /**
   * 进入室内预设视角（仍为 orbit/ortho，仅位姿与距离限制）。
   * persist=true 时写入 document.environment.defaultView（计入历史）。
   */
  enterIndoorView(options?: EnterIndoorViewOptions): DefaultViewJSON {
    const { persist = false, ...viewOpts } = options ?? {}
    const view = createIndoorDefaultView(this.doc.bounds, {
      fov: this.doc.environment.defaultView?.fov ?? viewOpts.fov ?? 60,
      ...viewOpts
    })
    this.applyDefaultView(view, { applyPose: true })
    if (persist) {
      const env = cloneEnvironment(this.doc.environment)
      env.defaultView = view
      this.doc.commands.setEnvironment(env)
    }
    return view
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
      this.applyVisualState(path, { color: null })
    })
    this.visualStates.clear()
  }

  private applyVisualState(nodePath: string, state: VisualState): void {
    const object = this.pathObjects.get(nodePath)
    if (!object) return
    const intensity = state.intensity ?? 1
    const highlightColor = state.color ?? null

    // 嵌套 path（如 柜id/元件id）的根物体：柜级高亮不得进入其子树
    const nestedRoots: THREE.Object3D[] = []
    const prefix = `${nodePath}/`
    this.pathObjects.forEach((obj, path) => {
      if (path.startsWith(prefix)) nestedRoots.push(obj)
    })

    object.traverse(child => {
      const mesh = child as THREE.Mesh
      if (!mesh.isMesh) return
      if (nestedRoots.some(root => isObjectUnder(mesh, root))) return

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

        if (!highlightColor) {
          const backup = backups?.[index]
          if (backup?.emissive) current.emissive.copy(backup.emissive)
          else current.emissive.setHex(0x000000)
          current.emissiveIntensity = backup?.emissiveIntensity ?? 1
        } else {
          current.emissive.set(highlightColor)
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
    this.floorApplyToken++
    this.ceilingApplyToken++
    this.wallApplyToken++
    this.clearMeshGroup(this.floorGroup, () => {
      this.floorMaterialHandle?.dispose()
      this.floorMaterialHandle = null
    })
    this.clearMeshGroup(this.ceilingGroup, () => {
      this.ceilingMaterialHandle?.dispose()
      this.ceilingMaterialHandle = null
    })
    this.unsubscribers.forEach(off => off())
    const dom = this.runtime.domElement
    dom.removeEventListener('pointerdown', this.selection.handlePointerDown)
    dom.removeEventListener('pointermove', this.selection.handlePointerMove)
    dom.removeEventListener('pointerup', this.selection.handlePointerUp)
    dom.removeEventListener('pointerleave', this.selection.handlePointerLeave)
    window.removeEventListener('resize', this.handleHoverResize)
    this.selection.dispose()
    this.hoverHighlight.dispose()
    Array.from(this.nodeRoots.keys()).forEach(id => this.removeNodeObject(id))
    if (this.wallMaterialHandle) {
      this.wallMaterialHandle.dispose()
      this.wallMaterialHandle = null
    }
    this.environment.dispose()
    this.runtime.dispose()
  }

  private handleHoverResize = (): void => {
    const width = this.runtime.domElement.clientWidth
    const height = this.runtime.domElement.clientHeight
    this.hoverHighlight.setSize(width, height)
  }
}

/** 仅墙/地/天花外观；网格/灯/相机变化不触发 rebuildWalls */
function shellEnvKey(env: EnvironmentJSON): string {
  return JSON.stringify({
    floor: env.floor,
    ceiling: env.ceiling,
    wall: env.wall
  })
}

export function create3DViewport(container: HTMLElement, options: Viewport3DOptions): Viewport3D {
  return new Viewport3D(container, options)
}

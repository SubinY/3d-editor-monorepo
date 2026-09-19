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
  resolveWallAppearance,
  wallAppearanceCacheKey
} from '../../document/resolve-wall-appearance'
import {
  createCeilingMaterial,
  createFloorMaterial,
  createPolygonCeilingMesh,
  createPolygonFloorMesh,
  outlineToUvBounds,
  type FloorMaterialHandle
} from './helpers/floor'
import {
  createWallMaterial,
  scaleWallBoxUVs,
  type WallMaterialHandle
} from './helpers/wall-material'
import { buildEnclosure } from './helpers/enclosure'
import { instantiateProceduralModule } from './services/procedural-module-loader'
import type { NodeInteractionHandler } from '../interaction-events'
import { findNodePath, isObjectUnder } from './utils/node-path'
import {
  applyTransformWithPivot,
  footprintHeightMeters,
  mountFootprintPivot,
  readTransformFromPivot
} from './utils/footprint-pivot'
import { fitObjectToFootprint } from './utils/fit-to-footprint'
import { disposeObject3D } from './utils/dispose'
import { bumpBuildToken, isBuildStale } from './utils/build-token'
import { getAssetHandle } from '../../catalog/asset-handle'
import { runProceduralResolvers } from '../../catalog/run-procedural-resolvers'
import { resolveLookIntent, createFrontDefaultView, createTopDefaultView } from './utils/look'
import type { CameraLookOptions, CameraLookTarget, CaptureSnapshopOptions } from './types'
import { cloneEnvironment } from '../../document/defaults'
import {
  composePreviewTransform,
  type NodeTransformPreview
} from '../node-preview'

export interface Viewport3DOptions {
  document: EditorDocument
  catalog?: CatalogProvider
  /** 只读预览：无 gizmo、不写 document；交互经 onInteraction 订阅通知 Host */
  readonly?: boolean
  transformModes?: TransformMode[]
  transformMode?: TransformMode
  snapEnabled?: boolean
  /** 左下角性能 Info；默认 false */
  perfStats?: boolean
  /** 悬停描边；默认 true */
  hoverOutline?: boolean
  /** Host 程序化模型解析链（model3d.type === 'procedural'） */
  proceduralResolvers?: ProceduralModelResolver[]
}

/** 嵌套解析深度上限（D2：scene → container → 元件） */
const MAX_RESOLVE_DEPTH = 2
/** 故障脉冲默认频率 */
const DEFAULT_PULSE_HZ = 1.2

interface MaterialBackup {
  color?: THREE.Color
  map?: THREE.Texture | null
  hasMap: boolean
  emissive?: THREE.Color
  emissiveIntensity?: number
}

function backupColorMaterial(mat: THREE.Material): MaterialBackup | null {
  const m = mat as THREE.MeshStandardMaterial
  if (!m || !('color' in m) || !m.color) return null
  return {
    color: m.color.clone(),
    hasMap: 'map' in m,
    map: 'map' in m ? (m.map ?? null) : undefined,
    emissive: m.emissive?.clone(),
    emissiveIntensity: m.emissiveIntensity
  }
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
  private proceduralResolvers: ProceduralModelResolver[]
  private interactionHandlers = new Set<NodeInteractionHandler>()

  private nodeRoots = new Map<string, THREE.Object3D>()
  private pathObjects = new Map<string, THREE.Object3D>()
  /** 可拾取根对象增量列表；与 nodeRoots 同步，供 SelectionService 复用 */
  private pickables: THREE.Object3D[] = []
  private wallGroup = new THREE.Group()
  private floorGroup = new THREE.Group()
  private ceilingGroup = new THREE.Group()
  private envGroup = new THREE.Group()
  private itemCache = new Map<string, CatalogItem>()
  private unsubscribers: Array<() => void> = []
  private disposed = false
  private visualStates = new Map<string, VisualState>()
  /** 临时色，避免每帧 new Color */
  private readonly pulseHighlight = new THREE.Color()
  private selection: SelectionService
  private hoverHighlight: HoverHighlight
  private environment: EnvironmentService
  /** 上次已写入的位姿键；仅 type/position/target 变化时才重置 Orbit */
  private lastCameraPoseKey: string | null = null
  private floorMaterialHandles: FloorMaterialHandle[] = []
  private floorApplyToken = 0
  private ceilingMaterialHandles: FloorMaterialHandle[] = []
  private ceilingApplyToken = 0
  private wallMaterialHandles = new Map<string, WallMaterialHandle>()
  private wallApplyToken = 0
  /** 墙相关 env 快照；仅变化时才 rebuild，避免开关网格整屏闪 */
  private lastShellEnvKey: string | null = null
  /** buildNode 竞态 token：同 id 递增使在途 await 失效 */
  private buildTokens = new Map<string, number>()
  private wallRebuildScheduled = false
  private workspaceRebuildScheduled = false
  /** 上次已应用到 3D 的 props 引用；变化时才调 AssetHandle.apply */
  private lastAppliedProps = new Map<string, Record<string, unknown> | undefined>()

  constructor(container: HTMLElement, options: Viewport3DOptions) {
    this.doc = options.document
    this.catalog = options.catalog ?? options.document.getCatalog()
    this.readonly = options.readonly ?? false
    this.proceduralResolvers = options.proceduralResolvers ?? []

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
      resolveEnclosure: this.proceduralResolvers.length
        ? async (kind, size) => this.resolveEnclosureProcedural(kind, size)
        : undefined
    })
    this.applyCameraFromEnvironment()
    void this.environment.apply(this.doc.environment, this.doc.bounds)
    this.lastShellEnvKey = shellEnvKey(this.doc.environment)

    this.scheduleWallRebuild()
    this.scheduleWorkspaceRebuild()
    void this.buildAllNodes()

    this.hoverHighlight = new HoverHighlight(this.runtime.renderer)
    const hoverOutline = options.hoverOutline ?? false
    this.selection = new SelectionService({
      doc: this.doc,
      runtime: this.runtime,
      readonly: this.readonly,
      nodeRoots: this.nodeRoots,
      pickables: this.pickables,
      pathObjects: this.pathObjects,
      hoverOutline,
      hoverHighlight: this.hoverHighlight,
      emitInteraction: (event) => {
        for (const handler of this.interactionHandlers) handler(event)
      }
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
      this.doc.on('wall:added', () => this.scheduleWallRebuild()),
      this.doc.on('wall:removed', () => this.scheduleWallRebuild()),
      this.doc.on('wall:updated', () => this.scheduleWallRebuild()),
      this.doc.on('workspace:added', () => this.scheduleWorkspaceRebuild()),
      this.doc.on('workspace:removed', () => this.scheduleWorkspaceRebuild()),
      this.doc.on('workspace:updated', () => this.scheduleWorkspaceRebuild()),
      this.doc.on('bounds:updated', () => {
        void this.environment.apply(this.doc.environment, this.doc.bounds)
        this.lastShellEnvKey = shellEnvKey(this.doc.environment)
        this.scheduleWallRebuild()
        this.scheduleWorkspaceRebuild()
      }),
      this.doc.on('environment:updated', ({ environment }) => {
        void this.environment.apply(environment, this.doc.bounds)
        this.applyCameraFromEnvironment()
        const shellKey = shellEnvKey(environment)
        if (shellKey !== this.lastShellEnvKey) {
          this.lastShellEnvKey = shellKey
          this.scheduleWallRebuild()
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
        const root = this.nodeRoots.get(nodeId)
        if (!node || !root) return
        const next = readTransformFromPivot(root)
        const result = this.doc.commands.transformNode(nodeId, next, { source: 'viewport3d' })
        if (!result.ok) {
          this.applyTransformToObject(root, node.transform)
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
    this.unsubscribers.push(this.runtime.onFrame(this.tickVisualPulse))
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

    this.applyLookView(view, applyPose)
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

  /** 合并同 tick 内多次 wall:* 事件，避免拖墙时 N 次完整重建 */
  private scheduleWallRebuild(): void {
    if (this.wallRebuildScheduled) return
    this.wallRebuildScheduled = true
    queueMicrotask(() => {
      this.wallRebuildScheduled = false
      if (this.disposed) return
      void this.rebuildWalls()
    })
  }

  private scheduleWorkspaceRebuild(): void {
    if (this.workspaceRebuildScheduled) return
    this.workspaceRebuildScheduled = true
    queueMicrotask(() => {
      this.workspaceRebuildScheduled = false
      if (this.disposed) return
      void this.rebuildFloors()
      void this.rebuildCeilings()
    })
  }

  /** 先建后换：避免 await 材质期间墙体消失导致闪烁；按外观缓存材质 */
  private async rebuildWalls(): Promise<void> {
    const token = ++this.wallApplyToken
    const walls = this.doc.getWalls()
    const envWall = this.doc.environment.wall
    const resolvedList = walls.map(wall => ({
      wall,
      resolved: resolveWallAppearance(wall, envWall, this.doc.bounds)
    }))

    const uniqueKeys = new Map<string, (typeof resolvedList)[0]['resolved']>()
    for (const item of resolvedList) {
      const key = wallAppearanceCacheKey(item.resolved)
      if (!uniqueKeys.has(key)) uniqueKeys.set(key, item.resolved)
    }

    const materialByKey = new Map<string, THREE.MeshStandardMaterial>()
    const nextHandles = new Map<string, WallMaterialHandle>()
    for (const [key, resolved] of uniqueKeys) {
      const handle = await createWallMaterial(resolved)
      if (token !== this.wallApplyToken || this.disposed) {
        handle.dispose()
        nextHandles.forEach(h => h.dispose())
        return
      }
      nextHandles.set(key, handle)
      materialByKey.set(key, handle.material)
    }

    const next = new THREE.Group()
    next.name = '__editorWalls__'
    for (const { wall, resolved } of resolvedList) {
      const key = wallAppearanceCacheKey(resolved)
      const material = materialByKey.get(key)!
      next.add(this.buildWallMesh(wall, resolved, material))
    }
    this.markNonSelectable(next)
    next.traverse(child => {
      child.raycast = () => {}
    })

    this.runtime.scene.remove(this.wallGroup)
    this.wallGroup.children.forEach(child => {
      ;(child as THREE.Mesh).geometry?.dispose()
    })
    this.wallGroup.clear()
    this.wallMaterialHandles.forEach(h => h.dispose())
    this.wallMaterialHandles.clear()

    this.wallMaterialHandles = nextHandles
    this.wallGroup = next
    this.runtime.scene.add(this.wallGroup)
    this.runtime.markShadowNeedsUpdate()
  }

  private clearMeshGroup(group: THREE.Group): void {
    while (group.children.length) {
      const child = group.children[0]
      group.remove(child)
      const mesh = child as THREE.Mesh
      if (mesh.geometry) mesh.geometry.dispose()
    }
  }

  private async rebuildFloors(): Promise<void> {
    const token = ++this.floorApplyToken
    this.clearMeshGroup(this.floorGroup)
    this.floorMaterialHandles.forEach(h => h.dispose())
    this.floorMaterialHandles = []

    const workspaces = this.doc.getWorkspaces()
    for (const ws of workspaces) {
      if (!ws.floor?.visible) continue
      const uvBounds = outlineToUvBounds(ws.outline)
      const handle = await createFloorMaterial(ws.floor, uvBounds)
      if (token !== this.floorApplyToken || this.disposed) {
        handle.dispose()
        return
      }
      this.floorMaterialHandles.push(handle)
      const mesh = createPolygonFloorMesh(ws.outline, handle.material)
      if (mesh) this.floorGroup.add(mesh)
    }

    this.markNonSelectable(this.floorGroup)
    this.floorGroup.traverse(child => {
      child.raycast = () => {}
    })
    this.runtime.markShadowNeedsUpdate()
  }

  private async rebuildCeilings(): Promise<void> {
    const token = ++this.ceilingApplyToken
    this.clearMeshGroup(this.ceilingGroup)
    this.ceilingMaterialHandles.forEach(h => h.dispose())
    this.ceilingMaterialHandles = []

    const workspaces = this.doc.getWorkspaces()
    for (const ws of workspaces) {
      if (!ws.ceiling?.visible) continue
      const height = ws.height ?? this.doc.bounds.height ?? 3
      const uvBounds = outlineToUvBounds(ws.outline)
      const handle = await createCeilingMaterial(ws.ceiling, uvBounds)
      if (token !== this.ceilingApplyToken || this.disposed) {
        handle.dispose()
        return
      }
      this.ceilingMaterialHandles.push(handle)
      const mesh = createPolygonCeilingMesh(ws.outline, handle.material, height)
      if (mesh) this.ceilingGroup.add(mesh)
    }

    this.markNonSelectable(this.ceilingGroup)
    this.ceilingGroup.traverse(child => {
      child.raycast = () => {}
    })
    this.runtime.markShadowNeedsUpdate()
  }

  private buildWallMesh(
    wall: WallJSON,
    resolved: ReturnType<typeof resolveWallAppearance>,
    material: THREE.MeshStandardMaterial
  ): THREE.Mesh {
    const span = Math.hypot(wall.b[0] - wall.a[0], wall.b[1] - wall.a[1])
    const { height, thickness, cornerOverlap, mapUrl, mapRepeat } = resolved
    const length = cornerOverlap
      ? Math.max(span, 0.01)
      : Math.max(span - thickness, 0.01)
    const embed = 0.01
    const geoHeight = height + embed
    const geometry = new THREE.BoxGeometry(length, geoHeight, thickness)
    if (mapUrl) {
      scaleWallBoxUVs(geometry, length, geoHeight, mapRepeat)
    }
    const mesh = new THREE.Mesh(geometry, material)
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
    const token = bumpBuildToken(this.buildTokens, node.id)
    this.removeNodeObject(node.id, { skipTokenBump: true })

    const root = new THREE.Group()
    root.name = node.name ?? node.id
    root.userData.nodePath = node.id

    const content = await this.buildNodeContent(node, node.id, 0)
    if (
      isBuildStale(this.buildTokens, node.id, token, {
        disposed: this.disposed,
        nodeExists: Boolean(this.doc.getNode(node.id))
      })
    ) {
      if (content) {
        this.runtime.releaseGltfFrom(content)
        disposeObject3D(content)
      }
      return
    }
    const item = this.doc.getCachedItem(node)
    mountFootprintPivot(THREE, root, content, footprintHeightMeters(item))
    this.applyTransformToObject(root, node.transform)
    root.visible = node.visible !== false

    this.nodeRoots.set(node.id, root)
    this.pathObjects.set(node.id, root)
    this.pickables.push(root)
    this.lastAppliedProps.set(node.id, node.props)
    this.runtime.scene.add(root)
    this.runtime.markShadowNeedsUpdate()

    // 恢复可能已设置的可视状态
    this.visualStates.forEach((state, path) => {
      if (path === node.id || path.startsWith(`${node.id}/`)) {
        this.applyVisualState(path, state)
      }
    })

    // placeItem 会先 selection.set 再异步 build；GLTF 未就绪时 syncGizmo 挂空。
    // 构建完成后若仍选中该节点，补挂 XYZ。
    if (this.doc.selection.first() === node.id && node.visible !== false) {
      this.selection.syncGizmo([node.id])
    }
  }

  private async buildNodeContent(
    node: EditorNodeJSON,
    path: string,
    depth: number
  ): Promise<THREE.Object3D | undefined> {
    if (!node.catalogRef) {
      return this.buildFootprintBox(undefined)
    }
    // 先填入 catalog 缓存，再取 Document 侧（含 props.footprint 覆盖）的条目
    await this.resolveItem(node.catalogRef.id, node.catalogRef.version)
    const item = this.doc.getCachedItem(node)
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
      const childItem = this.doc.getCachedItem(child)
      mountFootprintPivot(THREE, childObject, content, footprintHeightMeters(childItem))
      this.applyTransformToObject(childObject, child.transform)
      childObject.visible = child.visible !== false
      group.add(childObject)
      this.pathObjects.set(childPath, childObject)
    }
    return group
  }

  /**
   * 嵌套 document 外壳：gltf/procedural shell3d 优先；否则内层 enclosure
   *（openBox 内建，其它 id 走 Host/assets procedural）。
   */
  private async buildDocumentShell(
    item: CatalogItem,
    json: EditorDocumentJSON | undefined
  ): Promise<THREE.Object3D | undefined> {
    const shell3d = item.shell3d
    if (shell3d?.type === 'gltf') {
      return this.styleAsShell(await this.buildModel(shell3d, item), { seeThrough: false })
    }
    if (shell3d?.type === 'procedural') {
      return this.styleAsShell(await this.buildModel(shell3d, item))
    }

    const enclosure = json?.environment?.helpers?.enclosure
    if (enclosure && enclosure !== 'none') {
      const width = json?.bounds.width ?? item.footprint.width
      const depth = json?.bounds.depth ?? item.footprint.depth
      const height = json?.bounds.height ?? item.footprint.height ?? 2
      const built = await this.resolveEnclosureKind(enclosure, { width, height, depth })
      if (built) return this.styleAsShell(built)
    }

    if (shell3d) {
      return this.styleAsShell(await this.buildModel(shell3d, item), {
        seeThrough: (shell3d as { type: string }).type === 'gltf' ? false : undefined
      })
    }
    return undefined
  }

  /** openBox 内建；其它 enclosure id 走 procedural resolvers */
  private async resolveEnclosureKind(
    kind: string,
    size: { width: number; height: number; depth: number }
  ): Promise<THREE.Object3D | null> {
    if (kind === 'openBox') {
      return buildEnclosure(kind, size.width, size.height, size.depth)
    }
    const procedural = await this.resolveEnclosureProcedural(kind, size)
    return procedural ?? null
  }

  private async resolveEnclosureProcedural(
    kind: string,
    size: { width: number; height: number; depth: number }
  ): Promise<THREE.Object3D | null> {
    if (!this.proceduralResolvers.length || kind === 'none' || kind === 'openBox') {
      return null
    }
    const item: CatalogItem = {
      id: `__enclosure-${kind}__`,
      version: '0',
      name: kind,
      placeableIn: ['container'],
      footprint: {
        width: size.width,
        depth: size.depth,
        height: size.height
      }
    }
    const built = await runProceduralResolvers(
      this.proceduralResolvers,
      { id: kind },
      { item, THREE }
    )
    return built ?? null
  }

  /**
   * 标记外壳。开口盒等编辑壳默认半透明以便看内部；
   * GLB 实心壳（userData.solidShell / seeThrough:false）保持不透明，避免邻柜透叠。
   */
  private styleAsShell(
    shell: THREE.Object3D,
    options?: { seeThrough?: boolean }
  ): THREE.Object3D {
    const seeThrough = options?.seeThrough ?? shell.userData.solidShell !== true
    shell.userData.isShell = true
    if (seeThrough) shell.renderOrder = 1
    shell.traverse(child => {
      child.userData.isShell = true
      if (!seeThrough) return
      const mesh = child as THREE.Mesh
      if (!mesh.isMesh) return
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      materials.forEach(mat => {
        if (!mat) return
        mat.transparent = true
        mat.opacity = 0.88
        mat.depthWrite = false
        mat.side = THREE.DoubleSide
        mat.needsUpdate = true
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
        return fitObjectToFootprint(result.scene, item.footprint)
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
      if (!this.proceduralResolvers.length) {
        console.warn(
          `[viewport3d] procedural model "${spec.id}" but no procedural.resolvers injected; fallback box`
        )
        return this.buildFootprintBox(item)
      }
      try {
        const built = await runProceduralResolvers(
          this.proceduralResolvers,
          { id: spec.id },
          { item, THREE, node }
        )
        if (built) return built
        console.warn(`[viewport3d] procedural resolve returned empty for "${spec.id}"; fallback box`)
      } catch (error) {
        console.warn(`[viewport3d] procedural resolve failed for "${spec.id}"`, error)
      }
      return this.buildFootprintBox(item)
    }
    const w = item.footprint.width
    const d = item.footprint.depth
    const h = item.footprint.height ?? spec.size[1]
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

  /**
   * @param skipTokenBump buildNode 内部重建时已自增 token，避免二次 bump 把自己作废
   */
  private removeNodeObject(id: string, options?: { skipTokenBump?: boolean }): void {
    if (!options?.skipTokenBump) {
      bumpBuildToken(this.buildTokens, id)
    }
    const root = this.nodeRoots.get(id)
    if (!root) return
    const attached = this.runtime.getAttachedObject()
    if (attached && (attached === root || isObjectUnder(attached, root))) {
      this.runtime.attachTransform(null)
    }
    this.runtime.scene.remove(root)
    this.nodeRoots.delete(id)
    this.lastAppliedProps.delete(id)
    const pickIdx = this.pickables.indexOf(root)
    if (pickIdx >= 0) this.pickables.splice(pickIdx, 1)
    Array.from(this.pathObjects.keys())
      .filter(path => path === id || path.startsWith(`${id}/`))
      .forEach(path => this.pathObjects.delete(path))
    this.runtime.releaseGltfFrom(root)
    disposeObject3D(root)
    this.runtime.markShadowNeedsUpdate()
  }

  private syncNodeObject(node: EditorNodeJSON): void {
    const root = this.nodeRoots.get(node.id)
    if (!root) return

    const prevProps = this.lastAppliedProps.get(node.id)
    const nextFp = node.props?.footprint
    const prevFp = prevProps?.footprint
    const footprintChanged =
      JSON.stringify(nextFp ?? null) !== JSON.stringify(prevFp ?? null)
    if (footprintChanged) {
      this.lastAppliedProps.set(node.id, node.props)
      void this.buildNode(node)
      return
    }

    this.applyTransformToObject(root, node.transform)
    root.visible = node.visible !== false
    // 隐藏时立刻卸掉 gizmo（visible 变更不会走 selection:changed）
    if (node.visible === false && this.doc.selection.first() === node.id) {
      this.selection.syncGizmo([])
    } else if (node.visible !== false && this.doc.selection.first() === node.id) {
      this.selection.syncGizmo([node.id])
    }
    // transform / visible 变化后刷新阴影（Tier0: autoUpdate=false，按需 needsUpdate）
    this.runtime.markShadowNeedsUpdate()

    if (node.props === prevProps) return
    this.lastAppliedProps.set(node.id, node.props)
    const handle = getAssetHandle(root)
    if (handle) {
      void Promise.resolve(handle.apply(node.props)).then(() => {
        if (!this.disposed) this.runtime.markShadowNeedsUpdate()
      })
      return
    }
    // 无 handle 且带 props：整节点重建（兜底未知 procedural）
    if (node.props !== undefined) {
      void this.buildNode(node)
    }
  }

  private applyTransformToObject(object: THREE.Object3D, transform: TransformJSON): void {
    applyTransformWithPivot(object, transform)
  }

  /**
   * 2D 拖动中的 3D 预览：只改 Object3D，不写 document。
   * `preview === null` 时回到当前 document 变换。
   */
  previewNode(id: string, preview: NodeTransformPreview | null): void {
    const node = this.doc.getNode(id)
    const root = this.nodeRoots.get(id)
    if (!node || !root) return
    const transform = preview
      ? composePreviewTransform(node.transform, preview)
      : node.transform
    this.applyTransformToObject(root, transform)
    this.runtime.markShadowNeedsUpdate()
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

  /** Host 覆盖层 / 动态贴图：取节点根 Object3D */
  getNodeObject(nodeId: string): THREE.Object3D | undefined {
    return this.nodeRoots.get(nodeId) ?? this.pathObjects.get(nodeId)
  }

  getProjection(): CameraViewType {
    return this.runtime.getProjection()
  }

  /**
   * 3D 相机唯一写入口：复位 / 俯瞰 / 聚焦节点 / 室内预设。
   * persist 仅 `at:'indoor'` 且显式 true 时写回 defaultView。
   */
  look(target: CameraLookTarget, options?: CameraLookOptions): void {
    const pose = this.runtime.getCameraPose()
    const dom = this.runtime.domElement
    const intent = resolveLookIntent(
      target,
      {
        defaultView: this.doc.environment.defaultView ?? this.fallbackDefaultView(),
        bounds: this.doc.bounds,
        currentTarget: pose.target,
        currentRadius: pose.radius,
        currentProjection: this.runtime.getProjection(),
        selectedId: this.doc.selection.get()[0],
        aspect: dom.clientWidth / Math.max(dom.clientHeight, 1)
      },
      options
    )
    if (intent.action === 'noop') return
    if (intent.action === 'focus') {
      if (intent.projection) this.runtime.setProjection(intent.projection)
      const object = this.pathObjects.get(intent.path) ?? this.nodeRoots.get(intent.path)
      if (!object) return
      this.runtime.focusObject(object, intent.padding)
      return
    }
    this.applyLookView(intent.view, intent.applyPose, intent.up)
    if (intent.persist) {
      const env = cloneEnvironment(this.doc.environment)
      env.defaultView = intent.view
      this.doc.commands.setEnvironment(env)
    }
  }

  /**
   * 离屏静帧 PNG：临时相机 + RenderTarget，不改用户 Orbit / 主画布。
   * 默认正面正交 512×768；hideHelpers 藏网格与 TransformControls。
   */
  async captureSnapshop(options?: CaptureSnapshopOptions): Promise<Blob> {
    if (this.disposed) throw new Error('Viewport3D is disposed')

    const width = Math.max(1, Math.floor(options?.width ?? 512))
    const height = Math.max(1, Math.floor(options?.height ?? 768))
    const aspect = width / height
    const at = options?.at ?? 'front'
    const projection = options?.projection
    const padding = options?.padding
    const hideHelpers = options?.hideHelpers !== false

    const { view, up } = this.resolveCaptureView(at, aspect, projection, padding)
    const camera = this.createCaptureCamera(view, aspect, up)

    const grid = this.runtime.scene.getObjectByName('infinite-grid')
    const gridWasVisible = grid?.visible
    const transform = this.runtime.transform
    const transformWasVisible = transform?.visible

    if (hideHelpers) {
      if (grid) grid.visible = false
      if (transform) transform.visible = false
    }

    try {
      const pixels = this.runtime.renderOffscreen(camera, width, height)
      return await rgbaPixelsToPngBlob(pixels, width, height)
    } finally {
      if (hideHelpers) {
        if (grid && gridWasVisible != null) grid.visible = gridWasVisible
        if (transform && transformWasVisible != null) {
          transform.visible = transformWasVisible
        }
      }
    }
  }

  private resolveCaptureView(
    at: 'front' | 'home' | 'top',
    aspect: number,
    projection?: CameraViewType,
    padding?: number
  ): { view: DefaultViewJSON; up?: [number, number, number] } {
    if (at === 'front') {
      return createFrontDefaultView({
        bounds: this.doc.bounds,
        aspect,
        padding,
        projection: projection ?? 'orthographic'
      })
    }
    if (at === 'top') {
      const pose = this.runtime.getCameraPose()
      return createTopDefaultView({
        bounds: this.doc.bounds,
        fit: 'scene',
        currentTarget: pose.target,
        currentRadius: pose.radius,
        projection: projection ?? 'orthographic'
      })
    }
    const home = this.doc.environment.defaultView ?? this.fallbackDefaultView()
    const view =
      projection != null ? { ...home, type: projection } : { ...home }
    return { view }
  }

  private createCaptureCamera(
    view: DefaultViewJSON,
    aspect: number,
    up?: [number, number, number]
  ): THREE.PerspectiveCamera | THREE.OrthographicCamera {
    const near = 0.1
    const far = 2000
    const camUp = up ?? [0, 1, 0]
    if (view.type === 'orthographic') {
      const orthoSize = Math.max(view.fov ?? 1, 0.2)
      const cam = new THREE.OrthographicCamera(
        (-orthoSize * aspect) / 2,
        (orthoSize * aspect) / 2,
        orthoSize / 2,
        -orthoSize / 2,
        near,
        far
      )
      cam.up.set(camUp[0], camUp[1], camUp[2])
      cam.position.set(view.position[0], view.position[1], view.position[2])
      cam.lookAt(view.target[0], view.target[1], view.target[2])
      cam.updateProjectionMatrix()
      return cam
    }
    const cam = new THREE.PerspectiveCamera(view.fov ?? 50, aspect, near, far)
    cam.up.set(camUp[0], camUp[1], camUp[2])
    cam.position.set(view.position[0], view.position[1], view.position[2])
    cam.lookAt(view.target[0], view.target[1], view.target[2])
    cam.updateProjectionMatrix()
    return cam
  }

  private applyLookView(
    view: DefaultViewJSON,
    applyPose: boolean,
    up?: [number, number, number]
  ): void {
    const type = view.type === 'orthographic' ? 'orthographic' : 'orbit'
    const poseKey = `${type}|${view.position.join(',')}|${view.target.join(',')}`
    this.runtime.applyView(view, { applyPose, up })
    this.lastCameraPoseKey = poseKey
  }

  // -- 运行时可视状态（监控预览） --------------------------------------------------

  /**
   * 路径寻址：顶层节点为 nodeId；嵌套元件为 `${sceneNodeId}/${childNodeId}`。
   */
  setNodeVisualState(nodePath: string, state: VisualState): void {
    if (state.color == null && !state.pulse) {
      this.visualStates.delete(nodePath)
    } else {
      this.visualStates.set(nodePath, state)
    }
    this.applyVisualState(nodePath, state)
  }

  clearVisualStates(): void {
    Array.from(this.visualStates.keys()).forEach(path => {
      this.applyVisualState(path, { color: null })
    })
    this.visualStates.clear()
  }

  /** 对 pulse 节点按 sine 调制 intensity；无脉冲时零成本 */
  private tickVisualPulse = (nowMs: number): void => {
    if (this.disposed || this.visualStates.size === 0) return
    for (const [path, state] of this.visualStates) {
      if (!state.pulse || state.color == null) continue
      const hz = state.pulseHz ?? DEFAULT_PULSE_HZ
      const wave = 0.5 + 0.5 * Math.sin(nowMs * 0.001 * hz * Math.PI * 2)
      const base = state.intensity ?? 1
      const intensity = base * (0.28 + 0.72 * wave)
      this.applyVisualState(path, { color: state.color, intensity })
    }
  }

  private applyVisualState(nodePath: string, state: VisualState): void {
    const object = this.pathObjects.get(nodePath)
    if (!object) return
    const highlightColor = state.color ?? null
    const intensity =
      highlightColor == null
        ? 1
        : Math.min(1, Math.max(0, state.intensity ?? 1))

    // 嵌套 path（如 父id/子id）的根物体：父级高亮不得进入其子树
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
      if (!mesh.userData.__ownMaterial) {
        const cloned = materials.map(m => m.clone())
        mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0]
        mesh.userData.__ownMaterial = true
        mesh.userData.__origVisual = cloned.map(backupColorMaterial)
      }

      const currentList = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      const backups = mesh.userData.__origVisual as Array<MaterialBackup | null> | undefined
      currentList.forEach((mat, index) => {
        const current = mat as THREE.MeshStandardMaterial
        const backup = backups?.[index]
        if (!backup || !current?.color) return
        if (!highlightColor) {
          current.color.copy(backup.color!)
          if (backup.hasMap) current.map = backup.map ?? null
          if (current.emissive) {
            if (backup.emissive) current.emissive.copy(backup.emissive)
            else current.emissive.setHex(0x000000)
            current.emissiveIntensity = backup.emissiveIntensity ?? 1
          }
        } else {
          this.pulseHighlight.set(highlightColor)
          // albedo：原色 → 告警色，按 intensity 混合
          current.color.copy(backup.color!).lerp(this.pulseHighlight, Math.max(0.35, intensity))
          if (backup.hasMap) current.map = null
          if (current.emissive) {
            current.emissive.copy(this.pulseHighlight)
            current.emissiveIntensity = 0.15 + 0.85 * intensity
          }
        }
        current.needsUpdate = true
      })
    })
  }

  // -- 生命周期 -----------------------------------------------------------------

  /**
   * 3D 指针交互订阅（click / dblclick / longpress / hover）。
   * 对齐 onCameraPoseChange：创建后挂载，返回取消订阅。
   */
  onInteraction(handler: NodeInteractionHandler): () => void {
    this.interactionHandlers.add(handler)
    return () => this.interactionHandlers.delete(handler)
  }

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
    this.interactionHandlers.clear()
    this.floorApplyToken++
    this.ceilingApplyToken++
    this.wallApplyToken++
    this.clearMeshGroup(this.floorGroup)
    this.floorMaterialHandles.forEach(h => h.dispose())
    this.floorMaterialHandles = []
    this.clearMeshGroup(this.ceilingGroup)
    this.ceilingMaterialHandles.forEach(h => h.dispose())
    this.ceilingMaterialHandles = []
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
    this.pickables.length = 0
    this.buildTokens.clear()
    this.lastAppliedProps.clear()
    this.wallMaterialHandles.forEach(h => h.dispose())
    this.wallMaterialHandles.clear()
    this.environment.dispose()
    this.runtime.dispose()
  }

  private handleHoverResize = (): void => {
    const width = this.runtime.domElement.clientWidth
    const height = this.runtime.domElement.clientHeight
    this.hoverHighlight.setSize(width, height)
  }
}

/** 仅墙默认外观；网格/灯/相机变化不触发 rebuildWalls */
function shellEnvKey(env: EnvironmentJSON): string {
  return JSON.stringify({
    wall: env.wall
  })
}

/** WebGL readPixels 原点左下；翻转后写入 canvas → PNG Blob */
function rgbaPixelsToPngBlob(
  pixels: Uint8Array,
  width: number,
  height: number
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.reject(new Error('2d context unavailable'))
  const imageData = ctx.createImageData(width, height)
  const row = width * 4
  for (let y = 0; y < height; y++) {
    const src = (height - 1 - y) * row
    imageData.data.set(pixels.subarray(src, src + row), y * row)
  }
  ctx.putImageData(imageData, 0, 0)
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) reject(new Error('PNG encode failed'))
      else resolve(blob)
    }, 'image/png')
  })
}

export function create3DViewport(container: HTMLElement, options: Viewport3DOptions): Viewport3D {
  return new Viewport3D(container, options)
}

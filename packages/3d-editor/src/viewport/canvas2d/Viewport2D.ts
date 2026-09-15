import type { CatalogItem, CatalogProvider } from '../../catalog/types'
import { catalogKey } from '../../catalog/types'
import type { EditorDocument, PlaceResult } from '../../document/EditorDocument'
import type { EditorNodeJSON, TransformJSON } from '../../document/types'
import { Camera2D } from './services/camera'
import { paintScene } from './services/paint'
import { PlaceService } from './services/place'
import { SelectInteraction } from './services/select-interaction'
import type { Viewport2DContext } from './services/types'
import { WallInteraction } from './services/wall-interaction'
import { WorkspaceInteraction } from './services/workspace-interaction'
import type { Theme2D, Tool2D, Viewport2DOptions } from './types'
import { DEFAULT_THEME } from './types'
import { defaultContainerBackZ, defaultSceneGroundY } from './utils/place-defaults'
import type { NodeTransformPreview } from '../node-preview'
import { ensureSelectionHandleIcons } from './assets/handles'

/**
 * 2D 编辑视图门面：装配 camera / interactions / place / paint，按 tool 路由指针事件。
 * - scene：俯视 XZ（宽×深）
 * - container：立面 XY（宽×高，y 向上，底边为容器底）
 */
export class Viewport2D {
  public readonly canvas: HTMLCanvasElement

  private ctx: CanvasRenderingContext2D
  private doc: EditorDocument
  private catalog?: CatalogProvider
  private readonly readonly: boolean
  private theme: Theme2D
  private onDenied?: (reason: string) => void
  private onPlaceResult?: (result: PlaceResult) => void
  private onWallSelect?: Viewport2DOptions['onWallSelect']
  private onWorkspaceSelect?: Viewport2DOptions['onWorkspaceSelect']
  private onPickCandidates?: Viewport2DOptions['onPickCandidates']
  private onInsertWorkspaceVertexModeChange?: Viewport2DOptions['onInsertWorkspaceVertexModeChange']
  private canResizeNode?: Viewport2DOptions['canResizeNode']
  private snapEnabled: boolean

  private camera: Camera2D
  private select: SelectInteraction
  private wall: WallInteraction
  private workspace: WorkspaceInteraction
  private place: PlaceService

  private tool: Tool2D = 'select'
  private itemCache = new Map<string, CatalogItem>()
  private unsubscribers: Array<() => void> = []
  private raf = 0
  private showRulers = false
  private showNodeNames: boolean
  private rulerCursorSx: number | undefined
  private rulerCursorSy: number | undefined
  private previewNodeHandler?: (id: string, preview: NodeTransformPreview | null) => void

  constructor(container: HTMLElement, options: Viewport2DOptions) {
    this.doc = options.document
    this.catalog = options.catalog ?? options.document.getCatalog()
    this.readonly = options.readonly ?? false
    this.theme = { ...DEFAULT_THEME, ...(options.theme ?? {}) }
    this.onDenied = options.onDenied
    this.onPlaceResult = options.onPlaceResult
    this.onWallSelect = options.onWallSelect
    this.onWorkspaceSelect = options.onWorkspaceSelect
    this.onPickCandidates = options.onPickCandidates
    this.onInsertWorkspaceVertexModeChange = options.onInsertWorkspaceVertexModeChange
    this.canResizeNode = options.canResizeNode
    this.snapEnabled = options.snapEnabled ?? true
    this.showNodeNames = options.showNodeNames ?? false

    this.canvas = window.document.createElement('canvas')
    this.canvas.style.width = '100%'
    this.canvas.style.height = '100%'
    this.canvas.style.display = 'block'
    this.canvas.style.touchAction = 'none'
    container.appendChild(this.canvas)
    const ctx = this.canvas.getContext('2d')
    if (!ctx) throw new Error('canvas 2d context unavailable')
    this.ctx = ctx

    this.camera = new Camera2D(() => this.isElevation)
    const deps = this.createContext()
    this.select = new SelectInteraction(deps)
    this.wall = new WallInteraction(deps)
    this.workspace = new WorkspaceInteraction(deps)
    this.place = new PlaceService(deps, this.onPlaceResult)

    this.resize()
    this.fitBounds()

    const onChange = () => this.requestRender()
    this.unsubscribers.push(this.doc.on('change', onChange))
    this.unsubscribers.push(this.doc.on('selection:changed', onChange))
    this.unsubscribers.push(
      this.doc.on('selection:changed', () => {
        const id = this.select.insertVertexWorkspaceId
        if (id && !this.doc.selection.get().includes(id)) {
          this.cancelInsertWorkspaceVertex()
        }
      })
    )
    this.unsubscribers.push(this.doc.on('bounds:updated', () => this.fitBounds()))

    this.canvas.addEventListener('pointerdown', this.onPointerDown)
    this.canvas.addEventListener('pointermove', this.onPointerMove)
    this.canvas.addEventListener('pointerup', this.onPointerUp)
    this.canvas.addEventListener('pointerleave', this.onPointerLeave)
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false })
    this.canvas.addEventListener('contextmenu', this.onContextMenu)
    this.canvas.addEventListener('dragover', this.onDragOver)
    this.canvas.addEventListener('dragleave', this.onDragLeave)
    this.canvas.addEventListener('drop', this.onDrop)
    window.addEventListener('resize', this.onWindowResize)
    window.addEventListener('keydown', this.onKeyDown)

    this.prefetchItems()
    void ensureSelectionHandleIcons().then(() => this.requestRender())
    this.requestRender()
  }

  private get isElevation(): boolean {
    return this.doc.kind === 'container'
  }

  private createContext(): Viewport2DContext {
    const self = this
    return {
      get doc() {
        return self.doc
      },
      get readonly() {
        return self.readonly
      },
      get isElevation() {
        return self.isElevation
      },
      get scale() {
        return self.camera.scale
      },
      get snapEnabled() {
        return self.snapEnabled
      },
      get onDenied() {
        return self.onDenied
      },
      get onWallSelect() {
        return self.onWallSelect
      },
      get onWorkspaceSelect() {
        return self.onWorkspaceSelect
      },
      get onPickCandidates() {
        return self.onPickCandidates
      },
      get onInsertWorkspaceVertexModeChange() {
        return (active: boolean) => {
          self.onInsertWorkspaceVertexModeChange?.(active)
          self.syncCursor()
        }
      },
      clientToPlane: (x, y) => self.camera.clientToPlane(self.canvas, x, y),
      planeFromPosition: pos => self.planeFromPosition(pos),
      positionFromPlane: (u, v, base, item) => self.positionFromPlane(u, v, base, item),
      footprintSize: item => self.footprintSize(item),
      itemFor: node => self.itemFor(node),
      canResizeNode: node => self.nodeCanResize(node),
      nodeYaw: node => self.nodeYaw(node),
      yawToRotation: (yaw, base) => self.yawToRotation(yaw, base),
      requestRender: () => self.requestRender(),
      previewNode: (id, preview) => self.previewNodeHandler?.(id, preview)
    }
  }

  /** 由会话接入 Viewport3D.previewNode；未挂 3D 时不传 */
  setPreviewHandler(
    handler?: (id: string, preview: NodeTransformPreview | null) => void
  ): void {
    this.previewNodeHandler = handler
  }

  setSnapEnabled(enabled: boolean): void {
    this.snapEnabled = enabled
  }

  setRulersVisible(visible: boolean): void {
    this.showRulers = visible
    this.requestRender()
  }

  /** 开关 2D 节点 name 标签 */
  setShowNodeNames(visible: boolean): void {
    this.showNodeNames = visible
    this.requestRender()
  }

  getShowNodeNames(): boolean {
    return this.showNodeNames
  }

  setTool(tool: Tool2D): void {
    if (this.readonly) return
    if ((tool === 'wall' || tool === 'workspace') && this.isElevation) return
    if (tool !== 'select') this.cancelInsertWorkspaceVertex()
    this.tool = tool
    this.endWallChain()
    this.endWorkspaceChain()
    this.syncCursor()
    this.requestRender()
  }

  getTool(): Tool2D {
    return this.tool
  }

  /**
   * 进入工作区「边加点」：高亮边，可连续点击边插入顶点。
   * Esc / 取消按钮 / 取消选中 / 切工具 退出；点边插入后保持模式。
   */
  beginInsertWorkspaceVertex(workspaceId: string): void {
    if (this.readonly || this.isElevation) return
    const ws = this.doc.getWorkspace(workspaceId)
    if (!ws || ws.outline.length < 3) return
    this.tool = 'select'
    this.endWallChain()
    this.endWorkspaceChain()
    this.select.beginInsertVertex(workspaceId)
    this.doc.selection.set(workspaceId)
    this.syncCursor()
  }

  cancelInsertWorkspaceVertex(): void {
    this.select.endInsertVertex()
    this.syncCursor()
  }

  isInsertWorkspaceVertexMode(): boolean {
    return this.select.isInsertVertexMode()
  }

  private syncCursor(): void {
    if (this.select.isInsertVertexMode()) {
      this.canvas.style.cursor = 'crosshair'
      return
    }
    this.canvas.style.cursor =
      this.tool === 'wall' || this.tool === 'workspace'
        ? 'crosshair'
        : this.tool === 'pan'
          ? 'grab'
          : 'default'
  }

  endWallChain(): void {
    this.wall.endChain()
  }

  endWorkspaceChain(): void {
    this.workspace.endChain()
  }

  /** Esc / 右键：≥3 点闭合提交，否则取消当前绘制 */
  finishOrCancelWorkspace(): void {
    this.workspace.finishOrCancel()
  }

  clientToWorld(clientX: number, clientY: number): { x: number; z: number } {
    const p = this.camera.clientToPlane(this.canvas, clientX, clientY)
    return { x: p.u, z: p.v }
  }

  beginExternalDrag(item: CatalogItem): void {
    this.place.beginExternalDrag(item)
  }

  endExternalDrag(): void {
    this.place.endExternalDrag()
  }

  placeItemAt(item: CatalogItem, clientX: number, clientY: number): PlaceResult {
    return this.place.placeItemAt(item, clientX, clientY)
  }

  fitBounds(): void {
    const { width, height } = this.canvasSize()
    this.camera.fit(width, height, this.planeExtents())
    this.requestRender()
  }

  resize(): void {
    const dpr = window.devicePixelRatio || 1
    const rect = this.canvas.getBoundingClientRect()
    this.canvas.width = Math.max(1, Math.floor(rect.width * dpr))
    this.canvas.height = Math.max(1, Math.floor(rect.height * dpr))
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.requestRender()
  }

  requestRender(): void {
    if (this.raf) return
    this.raf = window.requestAnimationFrame(() => {
      this.raf = 0
      this.render()
    })
  }

  dispose(): void {
    this.unsubscribers.forEach(off => off())
    this.canvas.removeEventListener('pointerdown', this.onPointerDown)
    this.canvas.removeEventListener('pointermove', this.onPointerMove)
    this.canvas.removeEventListener('pointerup', this.onPointerUp)
    this.canvas.removeEventListener('pointerleave', this.onPointerLeave)
    this.canvas.removeEventListener('wheel', this.onWheel)
    this.canvas.removeEventListener('contextmenu', this.onContextMenu)
    this.canvas.removeEventListener('dragover', this.onDragOver)
    this.canvas.removeEventListener('dragleave', this.onDragLeave)
    this.canvas.removeEventListener('drop', this.onDrop)
    window.removeEventListener('resize', this.onWindowResize)
    window.removeEventListener('keydown', this.onKeyDown)
    if (this.raf) window.cancelAnimationFrame(this.raf)
    this.canvas.remove()
  }

  private canvasSize(): { width: number; height: number } {
    const rect = this.canvas.getBoundingClientRect()
    return { width: rect.width, height: rect.height }
  }

  private planeFromPosition(pos: [number, number, number]): { u: number; v: number } {
    return this.isElevation ? { u: pos[0], v: pos[1] } : { u: pos[0], v: pos[2] }
  }

  private positionFromPlane(
    u: number,
    v: number,
    base?: TransformJSON,
    item?: CatalogItem,
  ): [number, number, number] {
    if (this.isElevation) {
      const z =
        base?.position[2] ??
        (item ? defaultContainerBackZ(this.doc.bounds, item) : 0)
      return [u, v, z]
    }
    const y =
      base?.position[1] ?? (item ? defaultSceneGroundY(item) : 0)
    return [u, y, v]
  }

  private planeExtents(): { spanU: number; spanV: number; centerU: number; centerV: number } {
    if (this.isElevation) {
      const w = this.doc.bounds.width
      const h = this.doc.bounds.height ?? 2
      return { spanU: w, spanV: h, centerU: 0, centerV: h / 2 }
    }
    const walls = this.doc.getWalls()
    let spanU = this.doc.bounds.width
    let spanV = this.doc.bounds.depth
    if (walls.length) {
      let minX = Infinity
      let maxX = -Infinity
      let minZ = Infinity
      let maxZ = -Infinity
      walls.forEach(wall => {
        ;[wall.a, wall.b].forEach(([x, z]) => {
          minX = Math.min(minX, x)
          maxX = Math.max(maxX, x)
          minZ = Math.min(minZ, z)
          maxZ = Math.max(maxZ, z)
        })
      })
      spanU = Math.max(spanU, maxX - minX)
      spanV = Math.max(spanV, maxZ - minZ)
    }
    return { spanU, spanV, centerU: 0, centerV: 0 }
  }

  private footprintSize(item: CatalogItem | undefined): { wu: number; wv: number } {
    if (!item) return { wu: 1, wv: 1 }
    if (this.isElevation) {
      return { wu: item.footprint.width, wv: item.footprint.height ?? item.footprint.depth }
    }
    return { wu: item.footprint.width, wv: item.footprint.depth }
  }

  private async prefetchItems(): Promise<void> {
    const catalog = this.catalog
    if (!catalog) return
    for (const node of this.doc.getNodes()) {
      if (!node.catalogRef) continue
      const key = catalogKey(node.catalogRef.id, node.catalogRef.version)
      if (this.itemCache.has(key)) continue
      const item = await catalog.get(node.catalogRef.id, node.catalogRef.version)
      if (item) this.itemCache.set(key, item)
    }
    this.requestRender()
  }

  private itemFor(node: EditorNodeJSON): CatalogItem | undefined {
    if (!node.catalogRef) return undefined
    // Document 侧已叠加 props.footprint；优先走这里以免视口缓存脏读
    const fromDoc = this.doc.getCachedItem(node)
    if (fromDoc) return fromDoc

    const key = catalogKey(node.catalogRef.id, node.catalogRef.version)
    const cached = this.itemCache.get(key)
    if (cached) {
      this.doc.cacheItem(cached)
      return this.doc.getCachedItem(node) ?? cached
    }
    this.catalog?.get(node.catalogRef.id, node.catalogRef.version).then(item => {
      if (item) {
        this.itemCache.set(key, item)
        this.doc.cacheItem(item)
        this.requestRender()
      }
    })
    return undefined
  }

  private nodeCanResize(node: EditorNodeJSON): boolean {
    if (!this.canResizeNode) return true
    return this.canResizeNode(node, this.itemFor(node)) !== false
  }

  private nodeYaw(node: EditorNodeJSON): number {
    return this.isElevation ? node.transform.rotation[2] : node.transform.rotation[1]
  }

  private yawToRotation(yaw: number, base: TransformJSON['rotation']): [number, number, number] {
    return this.isElevation ? [base[0], base[1], yaw] : [base[0], yaw, base[2]]
  }

  private onPointerDown = (event: PointerEvent): void => {
    try {
      this.canvas.setPointerCapture(event.pointerId)
    } catch {
      /* ignore */
    }

    const panMode =
      this.tool === 'pan' ? 'pan' : this.tool === 'select' ? 'select' : 'off'
    if (this.camera.tryBeginPan(event, panMode)) {
      if (this.tool === 'pan') this.canvas.style.cursor = 'grabbing'
      return
    }
    if (this.tool === 'pan') return
    if (this.readonly) return

    const plane = this.camera.clientToPlane(this.canvas, event.clientX, event.clientY)
    if (this.tool === 'wall') {
      this.wall.onPointerDown(event, plane)
      return
    }
    if (this.tool === 'workspace') {
      this.workspace.onPointerDown(event, plane)
      return
    }
    this.select.onPointerDown(event, plane)
  }

  private onPointerMove = (event: PointerEvent): void => {
    // 追踪鼠标在 canvas 上的屏幕坐标，供游标尺准线使用
    if (this.showRulers) {
      const rect = this.canvas.getBoundingClientRect()
      this.rulerCursorSx = event.clientX - rect.left
      this.rulerCursorSy = event.clientY - rect.top
    }

    if (this.camera.onPanMove(event)) {
      this.requestRender()
      return
    }
    if (this.tool === 'pan') return
    if (this.readonly) return

    const plane = this.camera.clientToPlane(this.canvas, event.clientX, event.clientY)
    if (this.tool === 'wall') {
      this.wall.onPointerMove(event, plane)
      return
    }
    if (this.tool === 'workspace') {
      this.workspace.onPointerMove(event, plane)
      return
    }
    this.select.onPointerMove(event, plane)
  }

  private onPointerUp = (event: PointerEvent): void => {
    if (this.camera.endPan()) {
      if (this.tool === 'pan') this.canvas.style.cursor = 'grab'
      return
    }
    if (this.tool === 'pan') return
    if (this.readonly) return
    if (this.tool === 'wall') {
      this.wall.onPointerUp(event)
      return
    }
    if (this.tool === 'workspace') {
      this.workspace.onPointerUp(event)
      return
    }
    this.select.onPointerUp(event)
  }

  private onPointerLeave = (event: PointerEvent): void => {
    this.rulerCursorSx = undefined
    this.rulerCursorSy = undefined
    this.onPointerUp(event)
  }

  private onContextMenu = (event: MouseEvent): void => {
    event.preventDefault()
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && this.select.isInsertVertexMode()) {
      this.cancelInsertWorkspaceVertex()
      return
    }
    if (event.key === 'Escape' && this.tool === 'wall') this.endWallChain()
    if (event.key === 'Escape' && this.tool === 'workspace') {
      this.finishOrCancelWorkspace()
    }
    if (event.key === 'Enter' && this.tool === 'workspace') {
      this.workspace.tryCommitFromKeyboard()
    }
  }

  private onWheel = (event: WheelEvent): void => {
    event.preventDefault()
    this.camera.zoomAt(this.canvas, event.clientX, event.clientY, event.deltaY)
    this.requestRender()
  }

  private onWindowResize = (): void => {
    this.resize()
  }

  private onDragOver = (event: DragEvent): void => {
    this.place.onDragOver(event, (x, y) => this.camera.clientToPlane(this.canvas, x, y))
  }

  private onDragLeave = (): void => {
    this.place.onDragLeave()
  }

  private onDrop = (event: DragEvent): void => {
    this.place.onDrop(event)
  }

  private render(): void {
    const { width, height } = this.canvasSize()
    paintScene(
      {
        ctx: this.ctx,
        camera: this.camera,
        doc: this.doc,
        theme: this.theme,
        tool: this.tool,
        readonly: this.readonly,
        isElevation: this.isElevation,
        select: this.select,
        wall: this.wall,
        workspace: this.workspace,
        dropGhost: this.place.dropGhost,
        footprintSize: item => this.footprintSize(item),
        itemFor: node => this.itemFor(node),
        canResizeNode: node => this.nodeCanResize(node),
        planeFromPosition: pos => this.planeFromPosition(pos),
        showRulers: this.showRulers,
        rulerCursorSx: this.rulerCursorSx,
        rulerCursorSy: this.rulerCursorSy,
        showNodeNames: this.showNodeNames
      },
      width,
      height
    )
  }
}

export function create2DViewport(container: HTMLElement, options: Viewport2DOptions): Viewport2D {
  return new Viewport2D(container, options)
}

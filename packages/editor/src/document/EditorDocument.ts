import type { CatalogItem, CatalogProvider } from '../catalog/types'
import { catalogKey } from '../catalog/types'
import { createId } from '../utils/id'
import { findCollision, type CollisionHit } from './collision'
import { ConstraintEngine, type ConstraintResult } from './constraints'
import {
  DocumentEmitter,
  type DocumentEventMap
} from './events'
import { DocumentHistory } from './history'
import { DocumentSelection } from './selection'
import {
  SCHEMA_VERSION,
  cloneTransform,
  createDefaultTransform,
  type BoundsJSON,
  type DocumentKind,
  type EditorDocumentJSON,
  type EditorNodeJSON,
  type TransformJSON,
  type WallJSON
} from './types'

export interface CreateDocumentOptions {
  kind: DocumentKind
  id?: string
  name?: string
  bounds: BoundsJSON
  walls?: WallJSON[]
  metadata?: Record<string, unknown>
}

export interface PlaceOptions {
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: [number, number, number]
  name?: string
  props?: Record<string, unknown>
  parentId?: string
  select?: boolean
  source?: string
}

export interface PlaceResult {
  node?: EditorNodeJSON
  denied?: string
}

export interface TransformOptions {
  source?: string
}

export interface TransformResult {
  ok: boolean
  denied?: string
  transform?: TransformJSON
}

export interface ValidationWarning {
  nodeId: string
  rule: string
  message: string
}

/**
 * 运行时 Document：命令 / 历史 / 选中 / 事件。
 * 存盘形态见 EditorDocumentJSON；Host 经 createEditor 获得实例。
 */
export class EditorDocument {
  public readonly kind: DocumentKind
  public readonly id: string
  public name: string
  public bounds: BoundsJSON
  public metadata: Record<string, unknown>

  public readonly history = new DocumentHistory(100, () => this.emitChange())
  public readonly constraints = new ConstraintEngine()
  public readonly selection: DocumentSelection
  public collisionEnabled = true

  private nodes: EditorNodeJSON[] = []
  private walls: WallJSON[] = []
  private nodeIndex = new Map<string, EditorNodeJSON>()
  private parentIndex = new Map<string, string | undefined>()
  private emitter = new DocumentEmitter()
  private itemCache = new Map<string, CatalogItem>()
  private catalog?: CatalogProvider

  constructor(options: CreateDocumentOptions) {
    this.kind = options.kind
    this.id = options.id ?? createId(options.kind)
    this.name = options.name ?? options.kind
    this.bounds = { ...options.bounds }
    this.metadata = { ...(options.metadata ?? {}) }
    this.walls = (options.walls ?? []).map(wall => ({ ...wall }))
    this.selection = new DocumentSelection(ids => {
      this.emitter.emit('selection:changed', { ids })
    })
  }

  on<K extends keyof DocumentEventMap>(event: K, handler: (payload: DocumentEventMap[K]) => void): () => void {
    return this.emitter.on(event, handler)
  }

  off<K extends keyof DocumentEventMap>(event: K, handler: (payload: DocumentEventMap[K]) => void): void {
    this.emitter.off(event, handler)
  }

  private emitChange(): void {
    this.emitter.emit('change', undefined)
  }

  attachCatalog(catalog: CatalogProvider): void {
    this.catalog = catalog
  }

  getCatalog(): CatalogProvider | undefined {
    return this.catalog
  }

  cacheItem(item: CatalogItem): void {
    this.itemCache.set(catalogKey(item.id, item.version), item)
  }

  getCachedItem(node: EditorNodeJSON): CatalogItem | undefined {
    if (!node.catalogRef) return undefined
    return this.itemCache.get(catalogKey(node.catalogRef.id, node.catalogRef.version))
  }

  async resolveItems(): Promise<void> {
    if (!this.catalog) return
    const refs = new Map<string, { id: string; version: string }>()
    const collect = (nodes: EditorNodeJSON[]) => {
      nodes.forEach(node => {
        if (node.catalogRef) {
          refs.set(catalogKey(node.catalogRef.id, node.catalogRef.version), node.catalogRef)
        }
        if (node.children) collect(node.children)
      })
    }
    collect(this.nodes)
    await Promise.all(
      Array.from(refs.values()).map(async ref => {
        if (this.itemCache.has(catalogKey(ref.id, ref.version))) return
        const item = await this.catalog!.get(ref.id, ref.version)
        if (item) this.cacheItem(item)
      })
    )
  }

  getNodes(): EditorNodeJSON[] {
    return this.nodes
  }

  getNode(id: string): EditorNodeJSON | undefined {
    return this.nodeIndex.get(id)
  }

  getParentId(id: string): string | undefined {
    return this.parentIndex.get(id)
  }

  getWalls(): WallJSON[] {
    return this.walls
  }

  getWall(id: string): WallJSON | undefined {
    return this.walls.find(wall => wall.id === id)
  }

  private siblingsOf(parentId?: string): EditorNodeJSON[] {
    if (!parentId) return this.nodes
    return this.nodeIndex.get(parentId)?.children ?? []
  }

  checkCollision(
    transform: TransformJSON,
    item: CatalogItem | undefined,
    options?: { excludeId?: string; parentId?: string }
  ): CollisionHit | undefined {
    if (!this.collisionEnabled) return undefined
    return findCollision(
      this.siblingsOf(options?.parentId),
      transform,
      item,
      options?.excludeId,
      node => this.getCachedItem(node),
      this.kind === 'container' ? 'xy' : 'xz'
    )
  }

  private indexNode(node: EditorNodeJSON, parentId?: string): void {
    this.nodeIndex.set(node.id, node)
    this.parentIndex.set(node.id, parentId)
    node.children?.forEach(child => this.indexNode(child, node.id))
  }

  private unindexNode(node: EditorNodeJSON): void {
    this.nodeIndex.delete(node.id)
    this.parentIndex.delete(node.id)
    node.children?.forEach(child => this.unindexNode(child))
  }

  private insertNodeInternal(node: EditorNodeJSON, parentId: string | undefined, source?: string): void {
    if (parentId) {
      const parent = this.nodeIndex.get(parentId)
      if (!parent) throw new Error(`parent node "${parentId}" not found`)
      parent.children = parent.children ?? []
      parent.children.push(node)
    } else {
      this.nodes.push(node)
    }
    this.indexNode(node, parentId)
    this.emitter.emit('node:added', { node, parentId, source })
    this.emitChange()
  }

  private removeNodeInternal(id: string, source?: string): { node: EditorNodeJSON; parentId?: string } | undefined {
    const node = this.nodeIndex.get(id)
    if (!node) return undefined
    const parentId = this.parentIndex.get(id)
    const list = parentId ? this.nodeIndex.get(parentId)?.children : this.nodes
    if (!list) return undefined
    const index = list.indexOf(node)
    if (index >= 0) list.splice(index, 1)
    this.unindexNode(node)
    if (this.selection.isSelected(id)) {
      this.selection.set(this.selection.get().filter(sid => sid !== id))
    }
    this.emitter.emit('node:removed', { node, parentId, source })
    this.emitChange()
    return { node, parentId }
  }

  private applyTransformInternal(id: string, transform: TransformJSON, source?: string): void {
    const node = this.nodeIndex.get(id)
    if (!node) return
    node.transform = cloneTransform(transform)
    this.emitter.emit('node:updated', { node, parentId: this.parentIndex.get(id), source })
    this.emitChange()
  }

  private applyNodePatchInternal(
    id: string,
    patch: Partial<Pick<EditorNodeJSON, 'name' | 'visible' | 'props'>>,
    source?: string
  ): void {
    const node = this.nodeIndex.get(id)
    if (!node) return
    if (patch.name !== undefined) node.name = patch.name
    if (patch.visible !== undefined) node.visible = patch.visible
    if (patch.props !== undefined) node.props = { ...(node.props ?? {}), ...patch.props }
    this.emitter.emit('node:updated', { node, parentId: this.parentIndex.get(id), source })
    this.emitChange()
  }

  public readonly commands = {
    placeItem: (item: CatalogItem, options?: PlaceOptions): PlaceResult => {
      if (!item.placeableIn.includes(this.kind)) {
        return { denied: `item "${item.id}" is not placeable in ${this.kind}` }
      }
      this.cacheItem(item)

      const transform = createDefaultTransform()
      if (options?.position) transform.position = [...options.position]
      if (options?.rotation) transform.rotation = [...options.rotation]
      if (options?.scale) transform.scale = [...options.scale]

      const node: EditorNodeJSON = {
        id: createId(item.kind ?? 'node'),
        name: options?.name ?? item.name,
        catalogRef: { id: item.id, version: item.version },
        transform,
        props: options?.props ? { ...options.props } : undefined
      }

      const verdict = this.constraints.evaluate(
        { operation: 'place', node, transform: node.transform, item },
        this
      )
      if (!verdict.allowed) {
        return { denied: verdict.reason }
      }
      if (verdict.transform) node.transform = verdict.transform

      const parentId = options?.parentId
      const hit = this.checkCollision(node.transform, item, { parentId })
      if (hit) {
        return { denied: `collision:${hit.nodeName ?? hit.nodeId}` }
      }

      const source = options?.source
      this.insertNodeInternal(node, parentId, source)
      this.history.push({
        label: `place ${node.name ?? node.id}`,
        undo: () => this.removeNodeInternal(node.id),
        redo: () => this.insertNodeInternal(node, parentId)
      })

      if (options?.select !== false) {
        this.selection.set(node.id)
      }
      return { node }
    },

    transformNode: (id: string, next: Partial<TransformJSON>, options?: TransformOptions): TransformResult => {
      const node = this.nodeIndex.get(id)
      if (!node) return { ok: false, denied: 'node-not-found' }

      const before = cloneTransform(node.transform)
      const target: TransformJSON = {
        position: next.position ? [...next.position] : [...before.position],
        rotation: next.rotation ? [...next.rotation] : [...before.rotation],
        scale: next.scale ? [...next.scale] : [...before.scale]
      }

      const verdict: ConstraintResult = this.constraints.evaluate(
        { operation: 'transform', node, transform: target, item: this.getCachedItem(node) },
        this
      )
      if (!verdict.allowed) {
        return { ok: false, denied: verdict.reason }
      }
      const finalTransform = verdict.transform ?? target

      const hit = this.checkCollision(finalTransform, this.getCachedItem(node), {
        excludeId: id,
        parentId: this.parentIndex.get(id)
      })
      if (hit) {
        return { ok: false, denied: `collision:${hit.nodeName ?? hit.nodeId}` }
      }

      this.applyTransformInternal(id, finalTransform, options?.source)
      this.history.push({
        label: `transform ${node.name ?? id}`,
        undo: () => this.applyTransformInternal(id, before),
        redo: () => this.applyTransformInternal(id, finalTransform)
      })
      return { ok: true, transform: cloneTransform(finalTransform) }
    },

    removeNode: (id: string, options?: TransformOptions): boolean => {
      const removed = this.removeNodeInternal(id, options?.source)
      if (!removed) return false
      this.history.push({
        label: `remove ${removed.node.name ?? id}`,
        undo: () => this.insertNodeInternal(removed.node, removed.parentId),
        redo: () => this.removeNodeInternal(id)
      })
      return true
    },

    updateNode: (
      id: string,
      patch: Partial<Pick<EditorNodeJSON, 'name' | 'visible' | 'props'>>,
      options?: TransformOptions
    ): boolean => {
      const node = this.nodeIndex.get(id)
      if (!node) return false
      const before = {
        name: node.name,
        visible: node.visible,
        props: node.props ? { ...node.props } : undefined
      }
      this.applyNodePatchInternal(id, patch, options?.source)
      const after = {
        name: node.name,
        visible: node.visible,
        props: node.props ? { ...node.props } : undefined
      }
      this.history.push({
        label: `update ${node.name ?? id}`,
        undo: () => {
          const target = this.nodeIndex.get(id)
          if (!target) return
          target.name = before.name
          target.visible = before.visible
          target.props = before.props
          this.emitter.emit('node:updated', { node: target, parentId: this.parentIndex.get(id) })
          this.emitChange()
        },
        redo: () => {
          const target = this.nodeIndex.get(id)
          if (!target) return
          target.name = after.name
          target.visible = after.visible
          target.props = after.props
          this.emitter.emit('node:updated', { node: target, parentId: this.parentIndex.get(id) })
          this.emitChange()
        }
      })
      return true
    },

    addWall: (a: [number, number], b: [number, number], options?: { height?: number; thickness?: number }): WallJSON | undefined => {
      if (this.kind !== 'scene') return undefined
      const wall: WallJSON = {
        id: createId('wall'),
        a: [...a],
        b: [...b],
        height: options?.height ?? 3,
        thickness: options?.thickness ?? 0.2
      }
      const doAdd = () => {
        this.walls.push(wall)
        this.emitter.emit('wall:added', { wall })
        this.emitChange()
      }
      const doRemove = () => {
        this.walls = this.walls.filter(w => w.id !== wall.id)
        this.emitter.emit('wall:removed', { wall })
        this.emitChange()
      }
      doAdd()
      this.history.push({ label: 'add wall', undo: doRemove, redo: doAdd })
      return wall
    },

    removeWall: (id: string): boolean => {
      const wall = this.walls.find(w => w.id === id)
      if (!wall) return false
      const doRemove = () => {
        this.walls = this.walls.filter(w => w.id !== id)
        this.emitter.emit('wall:removed', { wall })
        this.emitChange()
      }
      const doAdd = () => {
        this.walls.push(wall)
        this.emitter.emit('wall:added', { wall })
        this.emitChange()
      }
      doRemove()
      this.history.push({ label: 'remove wall', undo: doAdd, redo: doRemove })
      return true
    },

    /** 批量更新墙端点（墙拖/端点联动）；一条历史；有近零长则整次拒绝 */
    moveWalls: (
      updates: Array<{ id: string; a: [number, number]; b: [number, number] }>
    ): boolean => {
      if (this.kind !== 'scene' || !updates.length) return false
      const MIN_LEN = 0.05
      for (const u of updates) {
        if (Math.hypot(u.b[0] - u.a[0], u.b[1] - u.a[1]) < MIN_LEN) return false
      }
      const before = updates.map(u => {
        const wall = this.walls.find(w => w.id === u.id)
        if (!wall) return null
        return {
          id: wall.id,
          a: [...wall.a] as [number, number],
          b: [...wall.b] as [number, number]
        }
      })
      if (before.some(b => !b)) return false
      const after = updates.map(u => ({
        id: u.id,
        a: [...u.a] as [number, number],
        b: [...u.b] as [number, number]
      }))

      const apply = (list: Array<{ id: string; a: [number, number]; b: [number, number] }>) => {
        list.forEach(item => {
          const wall = this.walls.find(w => w.id === item.id)
          if (!wall) return
          wall.a = [...item.a]
          wall.b = [...item.b]
          this.emitter.emit('wall:updated', { wall })
        })
        this.emitChange()
      }

      apply(after)
      this.history.push({
        label: 'move walls',
        undo: () => apply(before as Array<{ id: string; a: [number, number]; b: [number, number] }>),
        redo: () => apply(after)
      })
      return true
    },

    setBounds: (next: Partial<BoundsJSON>): void => {
      const before = { ...this.bounds }
      const after: BoundsJSON = {
        width: next.width ?? before.width,
        depth: next.depth ?? before.depth,
        height: next.height ?? before.height
      }
      if (after.width === before.width && after.depth === before.depth && after.height === before.height) {
        return
      }
      const apply = (bounds: BoundsJSON) => {
        this.bounds = { ...bounds }
        this.emitter.emit('bounds:updated', { bounds: this.bounds })
        this.emitChange()
      }
      apply(after)
      this.history.push({
        label: 'set bounds',
        undo: () => apply(before),
        redo: () => apply(after)
      })
    }
  }

  createRectRoom(options?: { height?: number; thickness?: number }): WallJSON[] {
    const hw = this.bounds.width / 2
    const hd = this.bounds.depth / 2
    const corners: Array<[number, number]> = [
      [-hw, -hd],
      [hw, -hd],
      [hw, hd],
      [-hw, hd]
    ]
    const walls: WallJSON[] = []
    for (let i = 0; i < corners.length; i++) {
      const wall = this.commands.addWall(corners[i], corners[(i + 1) % corners.length], options)
      if (wall) walls.push(wall)
    }
    return walls
  }

  validate(): ValidationWarning[] {
    const warnings: ValidationWarning[] = []
    this.nodes.forEach(node => {
      const verdict = this.constraints.evaluate(
        { operation: 'transform', node, transform: node.transform, item: this.getCachedItem(node) },
        this
      )
      if (!verdict.allowed) {
        warnings.push({
          nodeId: node.id,
          rule: verdict.reason ?? 'unknown',
          message: `node "${node.name ?? node.id}" violates constraint "${verdict.reason}"`
        })
      }
    })
    return warnings
  }

  toJSON(): EditorDocumentJSON {
    return JSON.parse(
      JSON.stringify({
        schemaVersion: SCHEMA_VERSION,
        kind: this.kind,
        id: this.id,
        name: this.name,
        unit: 'm' as const,
        bounds: this.bounds,
        structure: this.walls.length ? { walls: this.walls } : undefined,
        nodes: this.nodes,
        metadata: Object.keys(this.metadata).length ? this.metadata : undefined
      })
    )
  }

  static fromJSON(json: EditorDocumentJSON): EditorDocument {
    const doc = new EditorDocument({
      kind: json.kind,
      id: json.id,
      name: json.name,
      bounds: json.bounds,
      walls: json.structure?.walls,
      metadata: json.metadata
    })
    const nodes: EditorNodeJSON[] = JSON.parse(JSON.stringify(json.nodes ?? []))
    nodes.forEach(node => {
      doc.nodes.push(node)
      doc.indexNode(node, undefined)
    })
    return doc
  }
}

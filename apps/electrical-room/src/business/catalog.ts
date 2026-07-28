import {
  SCHEMA_VERSION,
  createMemoryCatalog,
  createDefaultEnvironment,
  catalogKey,
  MemoryCatalog
} from '@3d-editor/editor'
import type {
  CatalogItem,
  CatalogProvider,
  CatalogQuery,
  DocumentKind,
  EditorDocumentJSON,
  EditorNodeJSON
} from '@3d-editor/editor'
import * as api from './api'

// ---------------------------------------------------------------------------
// 墙构件（fixture 型：2D 放置贴墙吸附）
// ---------------------------------------------------------------------------

export const FIXTURE_ITEMS: CatalogItem[] = [
  {
    id: 'fix-door',
    version: '1.0.0',
    name: '门',
    kind: 'door',
    category: 'fixture',
    placeableIn: ['scene'],
    footprint: { width: 0.9, depth: 0.16, height: 2.1 },
    thumb: '#c9973f',
    model3d: { type: 'primitive', primitive: 'box', size: [0.9, 2.1, 0.12], color: '#c9973f' }
  },
  {
    id: 'fix-window',
    version: '1.0.0',
    name: '窗',
    kind: 'window',
    category: 'fixture',
    placeableIn: ['scene'],
    footprint: { width: 1.2, depth: 0.14, height: 1.2 },
    thumb: '#6db7e8',
    model3d: { type: 'primitive', primitive: 'box', size: [1.2, 1.2, 0.1], color: '#6db7e8' }
  },
  {
    id: 'fix-column',
    version: '1.0.0',
    name: '柱',
    kind: 'column',
    category: 'fixture',
    placeableIn: ['scene'],
    footprint: { width: 0.4, depth: 0.4, height: 3 },
    thumb: '#8d99a6',
    model3d: { type: 'primitive', primitive: 'box', size: [0.4, 3, 0.4], color: '#8d99a6' }
  }
]

// ---------------------------------------------------------------------------
// 元器件（component 型，柜内放置）— 前端 seed，不入库
// ---------------------------------------------------------------------------

export const COMPONENT_ITEMS: CatalogItem[] = [
  {
    id: 'comp-breaker',
    version: '1.0.0',
    name: '断路器',
    kind: 'component',
    category: 'component',
    placeableIn: ['container'],
    footprint: { width: 0.1, depth: 0.09, height: 0.14 },
    thumb: '#e67e22',
    model3d: { type: 'primitive', primitive: 'box', size: [0.1, 0.14, 0.09], color: '#e67e22' }
  },
  {
    id: 'comp-contactor',
    version: '1.0.0',
    name: '接触器',
    kind: 'component',
    category: 'component',
    placeableIn: ['container'],
    footprint: { width: 0.09, depth: 0.1, height: 0.11 },
    thumb: '#27ae60',
    model3d: { type: 'primitive', primitive: 'box', size: [0.09, 0.11, 0.1], color: '#27ae60' }
  },
  {
    id: 'comp-plc',
    version: '1.0.0',
    name: 'PLC 模块',
    kind: 'component',
    category: 'component',
    placeableIn: ['container'],
    footprint: { width: 0.18, depth: 0.12, height: 0.1 },
    thumb: '#8e44ad',
    model3d: { type: 'primitive', primitive: 'box', size: [0.18, 0.1, 0.12], color: '#8e44ad' }
  },
  {
    id: 'comp-meter',
    version: '1.0.0',
    name: '多功能电表',
    kind: 'component',
    category: 'component',
    placeableIn: ['container'],
    footprint: { width: 0.12, depth: 0.1, height: 0.12 },
    thumb: '#2980b9',
    model3d: { type: 'primitive', primitive: 'box', size: [0.12, 0.12, 0.1], color: '#2980b9' }
  },
  {
    id: 'comp-relay',
    version: '1.0.0',
    name: '继电器',
    kind: 'component',
    category: 'component',
    placeableIn: ['container'],
    footprint: { width: 0.06, depth: 0.07, height: 0.08 },
    thumb: '#c0392b',
    model3d: { type: 'primitive', primitive: 'box', size: [0.06, 0.08, 0.07], color: '#c0392b' }
  },
  {
    id: 'comp-terminal',
    version: '1.0.0',
    name: '端子排',
    kind: 'component',
    category: 'component',
    placeableIn: ['container'],
    footprint: { width: 0.3, depth: 0.06, height: 0.06 },
    thumb: '#95a5a6',
    model3d: { type: 'primitive', primitive: 'box', size: [0.3, 0.06, 0.06], color: '#95a5a6' }
  }
]

export const DEFAULT_CABINET_BOUNDS = { width: 0.8, depth: 0.6, height: 2 }
export const DEFAULT_SCENE_BOUNDS = { width: 20, depth: 15, height: 3 }

export const INITIAL_CABINET_VERSION = '1.0.0'

export function cabinetCatalogId(documentId: string): string {
  return `cabinet-${documentId}`
}

export function getEditingVersion(json: EditorDocumentJSON): string {
  const v = json.metadata?.editingVersion
  return typeof v === 'string' && v ? v : INITIAL_CABINET_VERSION
}

export function setEditingVersion(json: EditorDocumentJSON, version: string): EditorDocumentJSON {
  return {
    ...json,
    metadata: { ...(json.metadata ?? {}), editingVersion: version }
  }
}

function componentNode(
  id: string,
  itemId: string,
  name: string,
  x: number,
  y: number
): EditorNodeJSON {
  return {
    id,
    name,
    catalogRef: { id: itemId, version: '1.0.0' },
    transform: { position: [x, y, -0.15], rotation: [0, 0, 0], scale: [1, 1, 1] }
  }
}

export function cabinetDocument(
  id: string,
  name: string,
  nodes: EditorNodeJSON[],
  version = INITIAL_CABINET_VERSION
): EditorDocumentJSON {
  const bounds = { ...DEFAULT_CABINET_BOUNDS }
  return {
    schemaVersion: SCHEMA_VERSION,
    kind: 'container',
    id,
    name,
    unit: 'm',
    bounds,
    nodes,
    environment: createDefaultEnvironment('container', bounds),
    metadata: { editingVersion: version }
  }
}

/** 把 ContainerDocument 做成 scene 侧可放置的 document 型 Catalog 条目 */
export function cabinetItemFromDocument(
  json: EditorDocumentJSON,
  version: string,
  options?: { thumb?: string }
): CatalogItem {
  return {
    id: cabinetCatalogId(json.id),
    version,
    name: json.name,
    kind: 'cabinet',
    category: 'equipment',
    placeableIn: ['scene'],
    footprint: {
      width: json.bounds.width,
      depth: json.bounds.depth,
      height: json.bounds.height ?? 2
    },
    thumb: options?.thumb ?? '#3f7fbf',
    document: json,
    shell3d: {
      type: 'primitive',
      primitive: 'box',
      size: [json.bounds.width, json.bounds.height ?? 2, json.bounds.depth],
      color: '#31424f'
    }
  }
}

export function builtinCabinetDocuments(): EditorDocumentJSON[] {
  const power = cabinetDocument('builtin-power', '配电柜（内置）', [
    componentNode('brk-1', 'comp-breaker', '主断路器', -0.25, 1.4),
    componentNode('brk-2', 'comp-breaker', '支路断路器1', -0.08, 1.4),
    componentNode('brk-3', 'comp-breaker', '支路断路器2', 0.08, 1.4),
    componentNode('brk-4', 'comp-breaker', '支路断路器3', 0.25, 1.4),
    componentNode('meter-1', 'comp-meter', '总电表', -0.2, 0.9),
    componentNode('term-1', 'comp-terminal', '端子排', 0.1, 0.35)
  ])
  const control = cabinetDocument('builtin-control', '控制柜（内置）', [
    componentNode('plc-1', 'comp-plc', 'PLC 主机', -0.15, 1.2),
    componentNode('rly-1', 'comp-relay', '继电器1', 0.12, 1.35),
    componentNode('rly-2', 'comp-relay', '继电器2', 0.24, 1.35),
    componentNode('ctc-1', 'comp-contactor', '接触器', 0.05, 0.85),
    componentNode('term-2', 'comp-terminal', '端子排', -0.05, 0.3)
  ])
  return [power, control]
}

/** seed 元器件 + fixture + API 柜资产（latestOnly 控制 list 是否只出最新柜） */
export class HostCatalog implements CatalogProvider {
  private seed: MemoryCatalog
  private remoteCache = new Map<string, CatalogItem>()
  private latestOnly: boolean

  constructor(options?: { latestOnly?: boolean }) {
    this.latestOnly = options?.latestOnly ?? true
    this.seed = createMemoryCatalog([...COMPONENT_ITEMS, ...FIXTURE_ITEMS])
  }

  private cacheItem(item: CatalogItem): void {
    this.remoteCache.set(catalogKey(item.id, item.version), item)
  }

  async warmup(): Promise<void> {
    const remote = await api.listCatalog({
      placeableIn: undefined,
      latestOnly: false
    })
    this.remoteCache.clear()
    for (const item of remote) this.cacheItem(item)
  }

  async list(query?: CatalogQuery): Promise<CatalogItem[]> {
    const seedItems = await this.seed.list(query)
    let remote = Array.from(this.remoteCache.values())
    if (this.latestOnly) {
      const latest = new Map<string, CatalogItem>()
      for (const item of remote) {
        const prev = latest.get(item.id)
        if (!prev || compareVer(item.version, prev.version) > 0) latest.set(item.id, item)
      }
      remote = Array.from(latest.values())
    }
    if (query?.placeableIn) {
      remote = remote.filter(i => i.placeableIn.includes(query.placeableIn!))
    }
    if (query?.kind) remote = remote.filter(i => i.kind === query.kind)
    if (query?.category) remote = remote.filter(i => i.category === query.category)
    if (query?.tag) remote = remote.filter(i => i.tags?.includes(query.tag!))
    if (query?.text) {
      const text = query.text.toLowerCase()
      remote = remote.filter(i => i.name.toLowerCase().includes(text))
    }
    return [...seedItems, ...remote]
  }

  async get(id: string, version?: string): Promise<CatalogItem | undefined> {
    const fromSeed = await this.seed.get(id, version)
    if (fromSeed) return fromSeed

    if (version) {
      const cached = this.remoteCache.get(catalogKey(id, version))
      if (cached) return cached
      const fetched = await api.getCatalogVersion(id, version)
      if (fetched) this.cacheItem(fetched)
      return fetched
    }

    const latest = await api.getCatalogLatest(id)
    if (latest) this.cacheItem(latest)
    return latest
  }
}

function compareVer(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return 1
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return -1
  }
  return 0
}

export async function createEditorCatalog(kind: DocumentKind): Promise<HostCatalog> {
  const catalog = new HostCatalog({ latestOnly: kind === 'scene' })
  await catalog.warmup()
  return catalog
}

export async function createPreviewCatalog(): Promise<HostCatalog> {
  const catalog = new HostCatalog({ latestOnly: false })
  await catalog.warmup()
  return catalog
}

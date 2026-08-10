import {
  SCHEMA_VERSION,
  createMemoryCatalog,
  createDefaultEnvironment,
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
    model3d: { type: 'procedural', id: 'comp-breaker' }
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

/** ContainerDocument → scene 可放置的 document 型条目 */
export function cabinetItemFromDocument(
  json: EditorDocumentJSON,
  version: string = INITIAL_CABINET_VERSION,
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

function solidCabinetItem(cabinetId: string, name: string): CatalogItem {
  const { width, depth, height } = DEFAULT_CABINET_BOUNDS
  return {
    id: cabinetCatalogId(cabinetId),
    version: INITIAL_CABINET_VERSION,
    name,
    kind: 'cabinet',
    category: 'equipment',
    placeableIn: ['scene'],
    footprint: { width, depth, height },
    thumb: '#3f7fbf',
    model3d: {
      type: 'primitive',
      primitive: 'box',
      size: [width, height, depth],
      color: '#31424f'
    },
    metadata: { id: cabinetId }
  }
}

function fallbackDeviceItem(id: string, name?: string): CatalogItem {
  return {
    id,
    version: INITIAL_CABINET_VERSION,
    name: name || id,
    kind: 'component',
    category: 'component',
    placeableIn: ['container'],
    footprint: { width: 0.1, depth: 0.1, height: 0.1 },
    thumb: '#95a5a6',
    model3d: {
      type: 'primitive',
      primitive: 'box',
      size: [0.1, 0.1, 0.1],
      color: '#95a5a6'
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

const layoutCache = new Map<string, EditorDocumentJSON | null>()
const layoutInflight = new Map<string, Promise<EditorDocumentJSON | null>>()

async function loadContainerLayout(cabinetId: string): Promise<EditorDocumentJSON | null> {
  if (layoutCache.has(cabinetId)) return layoutCache.get(cabinetId)!
  const pending = layoutInflight.get(cabinetId)
  if (pending) return pending
  const task = api
    .getDocument('container', cabinetId)
    .then(rec => {
      const doc = rec?.json?.kind === 'container' ? rec.json : null
      layoutCache.set(cabinetId, doc)
      layoutInflight.delete(cabinetId)
      return doc
    })
    .catch(() => {
      layoutCache.set(cabinetId, null)
      layoutInflight.delete(cabinetId)
      return null
    })
  layoutInflight.set(cabinetId, task)
  return task
}

export function primeLayoutCache(docs: Record<string, EditorDocumentJSON | null | undefined>): void {
  for (const [id, doc] of Object.entries(docs)) {
    if (doc?.kind === 'container') layoutCache.set(id, doc)
  }
}

/**
 * Demo Catalog：list = placeable；get = 按需拉柜 layout 并内联 document。
 */
export class DemoCatalog implements CatalogProvider {
  private placeable: MemoryCatalog
  private kind: DocumentKind

  constructor(options: { kind: DocumentKind; placeables: CatalogItem[] }) {
    this.kind = options.kind
    const seed =
      options.kind === 'scene'
        ? [...FIXTURE_ITEMS, ...options.placeables]
        : [...COMPONENT_ITEMS, ...options.placeables]
    this.placeable = createMemoryCatalog(seed)
  }

  async list(query?: CatalogQuery): Promise<CatalogItem[]> {
    return this.placeable.list(query)
  }

  async get(id: string, version?: string): Promise<CatalogItem | undefined> {
    if (id.startsWith('cabinet-')) {
      const cabinetId = id.slice('cabinet-'.length)
      if (!cabinetId) return undefined
      const doc = await loadContainerLayout(cabinetId)
      if (doc) return cabinetItemFromDocument(doc, version || INITIAL_CABINET_VERSION)
      const fromList = await this.placeable.get(id, version)
      if (fromList) return fromList
      return solidCabinetItem(cabinetId, cabinetId)
    }

    const fromList = await this.placeable.get(id, version)
    if (fromList) return fromList

    if (id.startsWith('device-') || id.startsWith('comp-')) {
      return fallbackDeviceItem(id)
    }
    return undefined
  }
}

export function createDemoCatalog(
  kind: DocumentKind,
  placeables: CatalogItem[]
): DemoCatalog {
  return new DemoCatalog({ kind, placeables })
}

/** 预览：用 scene 文档引用的柜 layout 做 get 解析 */
export async function createPreviewCatalog(): Promise<DemoCatalog> {
  const placeables: CatalogItem[] = []
  try {
    const containers = await api.listContainers()
    for (const rec of containers) {
      if (rec.json.kind === 'container') {
        placeables.push(cabinetItemFromDocument(rec.json))
        layoutCache.set(rec.json.id, rec.json)
      }
    }
  } catch {
    /* empty */
  }
  return createDemoCatalog('scene', placeables)
}

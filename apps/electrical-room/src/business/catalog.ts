import {
  SCHEMA_VERSION,
  createMemoryCatalog,
  createDefaultEnvironment
} from '@mh/3d-editor'
import type {
  CatalogItem,
  CatalogProvider,
  CatalogQuery,
  DocumentKind,
  EditorDocumentJSON,
  EditorNodeJSON
} from '@mh/3d-editor'
import { panel } from '@mh/3d-editor-assets/common'
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
  },
  panel.catalogItem()
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

/** `cabinet-{id}@version` / `cabinet-{id}` → 业务柜 id */
export function parseCabinetIdFromCatalogLabel(catalog: string): string | null {
  if (!catalog || catalog === '-') return null
  const at = catalog.indexOf('@')
  const catalogId = at >= 0 ? catalog.slice(0, at) : catalog
  if (!catalogId.startsWith('cabinet-')) return null
  const id = catalogId.slice('cabinet-'.length)
  return id || null
}

export function getEditingVersion(json: EditorDocumentJSON): string {
  const v = json.props?.editingVersion
  return typeof v === 'string' && v ? v : INITIAL_CABINET_VERSION
}

export function setEditingVersion(json: EditorDocumentJSON, version: string): EditorDocumentJSON {
  return {
    ...json,
    props: { ...(json.props ?? {}), editingVersion: version }
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
    props: { editingVersion: version }
  }
}

/** ContainerDocument → scene 可放置的 document 型条目；壳走柜 enclosure，不写 shell3d */
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
    document: json
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

export function builtinCabinetDocuments(): EditorDocumentJSON[] {
  const power = cabinetDocument('builtin-power', '配电柜（内置）', [
    componentNode('brk-1', 'comp-breaker', '主断路器', -0.25, 1.4),
    componentNode('brk-2', 'comp-breaker', '支路断路器1', -0.08, 1.4),
    componentNode('brk-3', 'comp-breaker', '支路断路器2', 0.08, 1.4),
    componentNode('brk-4', 'comp-breaker', '支路断路器3', 0.25, 1.4),
    componentNode('ctc-1', 'comp-contactor', '接触器', -0.15, 0.9),
    componentNode('term-1', 'comp-terminal', '端子排', 0.1, 0.35)
  ])
  const control = cabinetDocument('builtin-control', '控制柜（内置）', [
    componentNode('brk-c1', 'comp-breaker', '控制断路器', -0.2, 1.35),
    componentNode('ctc-1', 'comp-contactor', '接触器1', 0.05, 1.2),
    componentNode('ctc-2', 'comp-contactor', '接触器2', 0.2, 1.2),
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
 * Host Catalog：list 按 placeableIn 过滤；get 解析柜 layout / 柜内白名单。
 * scene 种子含 COMPONENT_ITEMS，嵌套 document 展开时才能 get 到断路器等（list 仍滤掉）。
 * 草稿「我的素材」可运行时增删，不进默认白名单常量。
 */
export class DemoCatalog implements CatalogProvider {
  private placeable: ReturnType<typeof createMemoryCatalog>
  private drafts = new Map<string, CatalogItem>()

  constructor(options: { kind: DocumentKind; placeables: CatalogItem[]; drafts?: CatalogItem[] }) {
    const seed =
      options.kind === 'scene'
        ? [...FIXTURE_ITEMS, ...COMPONENT_ITEMS, ...options.placeables]
        : [...COMPONENT_ITEMS, ...options.placeables]
    this.placeable = createMemoryCatalog(seed)
    for (const item of options.drafts ?? []) this.setDraft(item)
  }

  private draftKey(id: string, version: string): string {
    return `${id}@${version}`
  }

  listDrafts(): CatalogItem[] {
    return Array.from(this.drafts.values())
  }

  setDraft(item: CatalogItem): void {
    this.drafts.set(this.draftKey(item.id, item.version), item)
    this.placeable.add(item)
  }

  removeDraft(id: string, version?: string): void {
    if (version) {
      this.drafts.delete(this.draftKey(id, version))
      this.placeable.remove(id, version)
      return
    }
    for (const key of Array.from(this.drafts.keys())) {
      if (!key.startsWith(`${id}@`)) continue
      this.drafts.delete(key)
    }
    this.placeable.remove(id)
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

    return this.placeable.get(id, version)
  }
}

export function createDemoCatalog(
  kind: DocumentKind,
  placeables: CatalogItem[],
  drafts: CatalogItem[] = []
): DemoCatalog {
  return new DemoCatalog({ kind, placeables, drafts })
}

/** 预览：用 scene 文档引用的柜 layout 做 get 解析，并合并资产草稿 */
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
  let drafts: CatalogItem[] = []
  try {
    drafts = await api.listAssetDrafts()
  } catch {
    /* empty */
  }
  return createDemoCatalog('scene', placeables, drafts)
}

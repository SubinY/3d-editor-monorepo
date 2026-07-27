import {
  SCHEMA_VERSION,
  createMemoryCatalog,
  createDefaultEnvironment
} from '@3d-editor/editor'
import type {
  CatalogItem,
  DocumentKind,
  EditorDocumentJSON,
  EditorNodeJSON,
  MemoryCatalog
} from '@3d-editor/editor'
import { listDocuments } from './storage'

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
// 元器件（component 型，柜内放置）
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

// ---------------------------------------------------------------------------
// 柜资产（document 型，场景放置）
// ---------------------------------------------------------------------------

/** 新建电柜的默认净空尺寸（米），创建表单可改 */
export const DEFAULT_CABINET_BOUNDS = { width: 0.8, depth: 0.6, height: 2 }

/** 电柜室工作区默认尺寸（进入编辑器后仍可改） */
export const DEFAULT_SCENE_BOUNDS = { width: 20, depth: 15, height: 3 }

function componentNode(id: string, itemId: string, name: string, x: number, y: number): EditorNodeJSON {
  return {
    id,
    name,
    catalogRef: { id: itemId, version: '1.0.0' },
    // container：x=水平（宽），y=离地高度（立面），z=进深（默认贴后壁前一点）
    transform: { position: [x, y, -0.15], rotation: [0, 0, 0], scale: [1, 1, 1] }
  }
}

function cabinetDocument(id: string, name: string, nodes: EditorNodeJSON[]): EditorDocumentJSON {
  const bounds = { ...DEFAULT_CABINET_BOUNDS }
  return {
    schemaVersion: SCHEMA_VERSION,
    kind: 'container',
    id,
    name,
    unit: 'm',
    bounds,
    nodes,
    environment: createDefaultEnvironment('container', bounds)
  }
}

/** 把一份 ContainerDocument 发布为场景侧可放置的 document 型 Catalog 条目 */
export function cabinetItemFromDocument(json: EditorDocumentJSON, options?: { thumb?: string }): CatalogItem {
  return {
    id: `cabinet-${json.id}`,
    version: '1.0.0',
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

/** 内置两种柜型，保证空仓库也能演示 */
export function builtinCabinetItems(): CatalogItem[] {
  // 立面布置：x 左右、y 离地高度（柜高 2m）
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
  return [
    cabinetItemFromDocument(power, { thumb: '#3f7fbf' }),
    cabinetItemFromDocument(control, { thumb: '#3fae8a' })
  ]
}

/** 用户保存的电柜（container 文档）即发布为场景侧柜资产 */
export function savedCabinetItems(): CatalogItem[] {
  const palette = ['#4f8fd0', '#3fae8a', '#b8873d', '#9a6fd0', '#d06f6f']
  return listDocuments('container').map((json, index) =>
    cabinetItemFromDocument(json, { thumb: palette[index % palette.length] })
  )
}

// ---------------------------------------------------------------------------
// 组装 Catalog（业务注入，编辑器内核不感知任何电柜概念）
// ---------------------------------------------------------------------------

export function createEditorCatalog(kind: DocumentKind): MemoryCatalog {
  const items: CatalogItem[] = [...COMPONENT_ITEMS]
  if (kind === 'scene') {
    items.push(...FIXTURE_ITEMS)
    items.push(...builtinCabinetItems())
    items.push(...savedCabinetItems())
  }
  return createMemoryCatalog(items)
}

/** 预览页需要全量条目（场景引用柜 + 柜内引用元件） */
export function createPreviewCatalog(): MemoryCatalog {
  return createMemoryCatalog([
    ...COMPONENT_ITEMS,
    ...FIXTURE_ITEMS,
    ...builtinCabinetItems(),
    ...savedCabinetItems()
  ])
}

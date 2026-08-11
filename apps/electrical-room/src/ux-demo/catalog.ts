import type { CatalogItem } from '@mh/3d-editor'

/** ux-demo 专用 Catalog（不依赖 API） */
export const UX_DEMO_CATALOG: CatalogItem[] = [
  {
    id: 'ux-cabinet-main',
    version: '1.0.0',
    name: '主配电柜',
    kind: 'equipment',
    category: 'equipment',
    placeableIn: ['scene'],
    footprint: { width: 0.8, depth: 0.6, height: 2.2 },
    thumb: '#8a939e',
    model3d: { type: 'procedural', id: 'ux-cabinet' }
  },
  {
    id: 'ux-cabinet-ups',
    version: '1.0.0',
    name: 'UPS 柜',
    kind: 'equipment',
    category: 'equipment',
    placeableIn: ['scene'],
    footprint: { width: 0.8, depth: 0.8, height: 2.0 },
    thumb: '#6b7280',
    model3d: { type: 'procedural', id: 'ux-cabinet-ups' }
  },
  {
    id: 'ux-cabinet-dist',
    version: '1.0.0',
    name: '配电箱',
    kind: 'equipment',
    category: 'equipment',
    placeableIn: ['scene'],
    footprint: { width: 0.5, depth: 0.35, height: 0.7 },
    thumb: '#9aa3ad',
    model3d: {
      type: 'primitive',
      primitive: 'box',
      size: [0.5, 0.7, 0.35],
      color: '#9aa3ad'
    }
  },
  {
    id: 'ux-ac',
    version: '1.0.0',
    name: '精密空调',
    kind: 'device',
    category: 'equipment',
    placeableIn: ['scene'],
    footprint: { width: 1.2, depth: 0.5, height: 2.0 },
    thumb: '#4a90a4',
    model3d: {
      type: 'primitive',
      primitive: 'box',
      size: [1.2, 2.0, 0.5],
      color: '#4a90a4'
    }
  },
  {
    id: 'ux-door',
    version: '1.0.0',
    name: '房间门',
    kind: 'door',
    category: 'fixture',
    placeableIn: ['scene'],
    footprint: { width: 0.9, depth: 0.16, height: 2.1 },
    thumb: '#c9973f',
    model3d: { type: 'procedural', id: 'ux-door' }
  },
  {
    id: 'ux-window',
    version: '1.0.0',
    name: '窗',
    kind: 'window',
    category: 'fixture',
    placeableIn: ['scene'],
    footprint: { width: 1.2, depth: 0.14, height: 1.2 },
    thumb: '#6db7e8',
    model3d: {
      type: 'primitive',
      primitive: 'box',
      size: [1.2, 1.2, 0.1],
      color: '#6db7e8'
    }
  },
  {
    id: 'ux-column',
    version: '1.0.0',
    name: '柱',
    kind: 'column',
    category: 'fixture',
    placeableIn: ['scene'],
    footprint: { width: 0.4, depth: 0.4, height: 3 },
    thumb: '#8d99a6',
    model3d: {
      type: 'primitive',
      primitive: 'box',
      size: [0.4, 3, 0.4],
      color: '#8d99a6'
    }
  }
]

export const UX_CATEGORY_META: Array<{ id: string; label: string }> = [
  { id: 'equipment', label: '电柜设备' },
  { id: 'fixture', label: '门窗柱' }
]

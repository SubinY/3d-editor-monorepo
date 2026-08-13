import type { CatalogItem } from '@mh/3d-editor'
import { panel, glowRing, alertBox } from '@mh/3d-editor-assets/common'

/** 低压电柜 / 控制柜 / 门 / LED / 摄像头 / 信息面板 / 场景光圈 / 告警光罩 */
export const CATALOG_ITEMS: CatalogItem[] = [
  {
    id: 'cab-lv',
    version: '1.0.0',
    name: '低压电柜',
    kind: 'cabinet',
    category: 'equipment',
    placeableIn: ['scene'],
    footprint: { width: 0.8, depth: 0.6, height: 2 },
    thumb: '#3B82F6',
    model3d: {
      type: 'primitive',
      primitive: 'box',
      size: [0.8, 2, 0.6],
      color: '#3f4f5f'
    },
    metadata: {
      defaults: {
        ratedVoltage: 380,
        ratedCurrent: 250,
        status: 'normal'
      }
    }
  },
  {
    id: 'cab-ctrl',
    version: '1.0.0',
    name: '控制柜',
    kind: 'cabinet',
    category: 'equipment',
    placeableIn: ['scene'],
    footprint: { width: 0.8, depth: 0.6, height: 2 },
    thumb: '#8B5CF6',
    model3d: {
      type: 'primitive',
      primitive: 'box',
      size: [0.8, 2, 0.6],
      color: '#4a5568'
    },
    metadata: {
      defaults: {
        ratedVoltage: 380,
        ratedCurrent: 100,
        status: 'normal'
      }
    }
  },
  {
    id: 'fix-door',
    version: '1.0.0',
    name: '门',
    kind: 'door',
    category: 'fixture',
    placeableIn: ['scene'],
    footprint: { width: 0.9, depth: 0.16, height: 2.0 },
    thumb: '#C9973F',
    model3d: {
      type: 'primitive',
      primitive: 'box',
      size: [0.9, 2.0, 0.12],
      color: '#c9973f'
    }
  },
  {
    id: 'fix-led',
    version: '1.0.0',
    name: 'LED灯',
    kind: 'light',
    category: 'fixture',
    placeableIn: ['scene'],
    footprint: { width: 1.2, depth: 0.2, height: 0.08 },
    thumb: '#FBBF24',
    model3d: {
      type: 'primitive',
      primitive: 'box',
      size: [1.2, 0.08, 0.2],
      color: '#f5e6a3'
    }
  },
  {
    id: 'fix-camera',
    version: '1.0.0',
    name: '摄像头',
    kind: 'camera',
    category: 'fixture',
    placeableIn: ['scene'],
    footprint: { width: 0.18, depth: 0.18, height: 0.18 },
    thumb: '#38BDF8',
    model3d: {
      type: 'primitive',
      primitive: 'box',
      size: [0.18, 0.18, 0.18],
      color: '#1e293b'
    }
  },
  panel.catalogItem(),
  glowRing.catalogItem(),
  alertBox.catalogItem()
]

export function findCatalogItem(id: string): CatalogItem | undefined {
  return CATALOG_ITEMS.find(item => item.id === id)
}

export const EQUIPMENT_ITEMS = CATALOG_ITEMS.filter(i => i.category === 'equipment')
export const FIXTURE_ITEMS = CATALOG_ITEMS.filter(i => i.category === 'fixture')
export const OVERLAY_ITEMS = CATALOG_ITEMS.filter(
  i => i.kind === 'panel' || i.category === 'effect'
)

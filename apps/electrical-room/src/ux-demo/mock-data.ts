/** 产品壳 UX Demo 本地 mock，不接 editor 内核 */

export type EditorTool =
  | 'select'
  | 'wall'
  | 'door'
  | 'cabinet'
  | 'device'
  | 'measure'
  | 'camera'

export type ViewMode = '2d' | '3d' | 'split'
export type ViewportBackend = 'mock' | 'three'
export type RightTab = 'properties' | 'transform' | 'bindings' | 'events'

export interface MockAsset {
  id: string
  name: string
  category: string
  sizeLabel: string
  w: number
  d: number
  h: number
  thumb: string
  favorite?: boolean
  version?: string
  brand?: string
}

export interface MockBinding {
  key: string
  label: string
  alias: string
  unit?: string
  value: string
  spark: number[]
}

export interface MockEventRule {
  id: string
  name: string
  when: string
  then: string
  enabled: boolean
}

export interface MockNode {
  id: string
  name: string
  assetId: string
  category: string
  /** 俯视坐标（米），房间约 12×10 */
  x: number
  z: number
  yawDeg: number
  w: number
  d: number
  h: number
  description: string
  location: string
  status: 'online' | 'warning' | 'alarm' | 'offline'
  doorOpen?: boolean
  color: string
  bindings: MockBinding[]
  events: MockEventRule[]
  interior?: Array<{ id: string; name: string; y: number; w: number; h: number; color: string }>
}

export interface PublishCheckItem {
  id: string
  label: string
  ok: boolean
  detail?: string
}

export const PROJECT_NAME = '电气室 A'

export const TOOLS: Array<{ id: EditorTool; label: string }> = [
  { id: 'select', label: '选择' },
  { id: 'wall', label: '画墙' }
]

export const CATEGORIES: Array<{ id: string; label: string; count: number }> = [
  { id: 'cabinets', label: '电柜', count: 24 },
  { id: 'electrical', label: '电气设备', count: 43 },
  { id: 'devices', label: '装置', count: 98 },
  { id: 'doors', label: '门窗', count: 12 },
  { id: 'walls', label: '墙柱', count: 8 },
  { id: 'floor', label: '地面天花', count: 6 },
  { id: 'others', label: '其他', count: 15 }
]

export const STATUS_LABEL: Record<MockNode['status'], string> = {
  online: '在线',
  warning: '告警',
  alarm: '故障',
  offline: '离线'
}

function spark(seed: number): number[] {
  return Array.from({ length: 12 }, (_, i) => 40 + ((seed * (i + 3)) % 50))
}

export const INITIAL_ASSETS: MockAsset[] = [
  {
    id: 'asset-main',
    name: '主配电柜',
    category: 'cabinets',
    sizeLabel: '600×800×2200',
    w: 0.8,
    d: 0.6,
    h: 2.2,
    thumb: '#5a6570',
    favorite: true,
    version: 'v2.1.0',
    brand: 'ABB MNS 2.0'
  },
  {
    id: 'asset-dist',
    name: '配电箱',
    category: 'cabinets',
    sizeLabel: '400×300×600',
    w: 0.4,
    d: 0.3,
    h: 0.6,
    thumb: '#6b7280',
    favorite: true
  },
  {
    id: 'asset-ups',
    name: 'UPS 柜',
    category: 'cabinets',
    sizeLabel: '800×800×2000',
    w: 0.8,
    d: 0.8,
    h: 2.0,
    thumb: '#4b5563',
    favorite: true
  },
  {
    id: 'asset-ac',
    name: '精密空调',
    category: 'devices',
    sizeLabel: '1200×500×2000',
    w: 1.2,
    d: 0.5,
    h: 2.0,
    thumb: '#64748b',
    favorite: true
  },
  {
    id: 'asset-breaker',
    name: '断路器 MCCB NSX160N',
    category: 'electrical',
    sizeLabel: '105×86×161',
    w: 0.105,
    d: 0.086,
    h: 0.161,
    thumb: '#e67e22'
  },
  {
    id: 'asset-door',
    name: '房间门',
    category: 'doors',
    sizeLabel: '900×160×2100',
    w: 0.9,
    d: 0.16,
    h: 2.1,
    thumb: '#c9973f'
  }
]

export function createDefaultBindings(): MockBinding[] {
  return [
    {
      key: 'temp',
      label: '温度',
      alias: '柜内温度',
      unit: '°C',
      value: '32.5',
      spark: spark(7)
    },
    {
      key: 'humidity',
      label: '湿度',
      alias: '湿度',
      unit: '%RH',
      value: '45',
      spark: spark(11)
    },
    {
      key: 'power',
      label: '功率',
      alias: '功率',
      unit: 'kW',
      value: '12.6',
      spark: spark(13)
    },
    {
      key: 'alarm',
      label: '告警',
      alias: '告警',
      value: '正常',
      spark: spark(3)
    }
  ]
}

export function createDefaultEvents(): MockEventRule[] {
  return [
    {
      id: 'ev-1',
      name: '高温告警',
      when: 'temp > 40',
      then: '高亮红色 + 推送',
      enabled: true
    },
    {
      id: 'ev-2',
      name: '功率突变',
      when: 'power delta > 5kW',
      then: '闪烁描边',
      enabled: false
    }
  ]
}

export const POINT_LIBRARY: Array<{ key: string; label: string; unit?: string }> = [
  { key: 'temp', label: '温度', unit: '°C' },
  { key: 'humidity', label: '湿度', unit: '%RH' },
  { key: 'power', label: '功率', unit: 'kW' },
  { key: 'voltage', label: '电压 Uab', unit: 'V' },
  { key: 'current', label: '电流 Ia', unit: 'A' },
  { key: 'pf', label: '功率因数', unit: '' },
  { key: 'alarm', label: '告警码' },
  { key: 'door', label: '柜门状态' },
  { key: 'smoke', label: '烟感' },
  { key: 'leak', label: '漏水' }
]

export const INITIAL_NODES: MockNode[] = [
  {
    id: 'cab-a12',
    name: '电柜 A-12',
    assetId: 'asset-main',
    category: '主配电柜',
    x: 4.2,
    z: 3.5,
    yawDeg: 0,
    w: 0.8,
    d: 0.6,
    h: 2.2,
    description: '主进线配电柜',
    location: '电气室 A › 第 2 排',
    status: 'online',
    doorOpen: false,
    color: '#7a8694',
    bindings: createDefaultBindings(),
    events: createDefaultEvents(),
    interior: [
      { id: 'br-1', name: '断路器 QF-01', y: 1.6, w: 0.12, h: 0.18, color: '#e67e22' },
      { id: 'br-2', name: '接触器 KM-01', y: 1.2, w: 0.1, h: 0.14, color: '#27ae60' },
      { id: 'br-3', name: 'PLC 模块', y: 0.7, w: 0.18, h: 0.12, color: '#8e44ad' }
    ]
  },
  {
    id: 'cab-b03',
    name: '电柜 B-03',
    assetId: 'asset-main',
    category: '主配电柜',
    x: 6.5,
    z: 3.5,
    yawDeg: 0,
    w: 0.8,
    d: 0.6,
    h: 2.2,
    description: '馈线柜',
    location: '电气室 A › 第 2 排',
    status: 'online',
    color: '#6b7785',
    bindings: createDefaultBindings(),
    events: []
  },
  {
    id: 'cab-row-l1',
    name: '左侧排柜 1',
    assetId: 'asset-ups',
    category: 'UPS',
    x: 1.8,
    z: 5.5,
    yawDeg: 90,
    w: 0.8,
    d: 0.8,
    h: 2.0,
    description: 'UPS 机组',
    location: '电气室 A › 左墙',
    status: 'warning',
    color: '#5c6672',
    bindings: createDefaultBindings(),
    events: []
  },
  {
    id: 'cab-row-r1',
    name: '右侧排柜 1',
    assetId: 'asset-main',
    category: '主配电柜',
    x: 10.2,
    z: 5.0,
    yawDeg: -90,
    w: 0.8,
    d: 0.6,
    h: 2.2,
    description: '右墙排柜',
    location: '电气室 A › 右墙',
    status: 'online',
    color: '#707986',
    bindings: createDefaultBindings(),
    events: []
  },
  {
    id: 'dev-ac1',
    name: '空调机组',
    assetId: 'asset-ac',
    category: '暖通',
    x: 2.5,
    z: 8.2,
    yawDeg: 0,
    w: 1.2,
    d: 0.5,
    h: 2.0,
    description: '精密制冷',
    location: '电气室 A › 后侧',
    status: 'online',
    color: '#4a90a4',
    bindings: createDefaultBindings().slice(0, 2),
    events: []
  },
  {
    id: 'box-1',
    name: '配电箱',
    assetId: 'asset-dist',
    category: '配电',
    x: 5.5,
    z: 7.0,
    yawDeg: 15,
    w: 0.4,
    d: 0.3,
    h: 0.6,
    description: '落地配电箱',
    location: '电气室 A › 中部',
    status: 'offline',
    color: '#8a9099',
    bindings: [],
    events: []
  }
]

export const PUBLISH_CHECKS: PublishCheckItem[] = [
  { id: 'c1', label: '资源完整', ok: true, detail: '24 个资产' },
  { id: 'c2', label: '点位绑定', ok: true, detail: '通过' },
  { id: 'c3', label: '碰撞检测', ok: true, detail: '无重叠' },
  { id: 'c4', label: '性能评估', ok: true, detail: '预估 120 万三角面' },
  { id: 'c5', label: '生成快照', ok: true, detail: '完成' }
]

export const AI_LAYOUT_PLANS = [
  {
    id: 'A',
    name: 'AI 建议方案 A',
    summary: '通道净宽 ≥ 1200 毫米，设备间距优化',
    score: 92,
    offsets: { 'cab-a12': { x: 4.0, z: 3.2 }, 'cab-b03': { x: 6.8, z: 3.2 } }
  },
  {
    id: 'B',
    name: 'AI 建议方案 B',
    summary: '靠墙排布，中心留巡检通道',
    score: 88,
    offsets: { 'cab-a12': { x: 3.5, z: 2.8 }, 'cab-b03': { x: 5.2, z: 2.8 } }
  }
]

export const ROOM = { width: 12, depth: 10 }

export function statusColor(status: MockNode['status']): string {
  switch (status) {
    case 'online':
      return '#22c55e'
    case 'warning':
      return '#f5a623'
    case 'alarm':
      return '#ef4444'
    default:
      return '#64748b'
  }
}

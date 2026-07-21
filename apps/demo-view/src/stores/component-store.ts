export type ComponentCategory = 'structure' | 'electrical' | 'auxiliary' | 'imported'
export type ComponentKind = 'cabinet' | 'part'
export type CabinetPanelAxis = 'xy' | 'xz'
export type CabinetPanelOrigin = 'top-left' | 'center'

export interface CabinetMeta {
  panel: {
    widthMm: number
    heightMm: number
    origin: CabinetPanelOrigin
    axis: CabinetPanelAxis
  }
  /** 安装板中心在机柜本地空间的 3D 坐标 (米)，用于 2D→3D 派生。xy 面板时为 [x, y, z] */
  panelOrigin3d?: [number, number, number]
  thicknessMm?: number
}

export interface ComponentRecord {
  id: string
  name: string
  category: ComponentCategory
  kind?: ComponentKind
  cabinetMeta?: CabinetMeta
  resourceId: string
  symbolResourceId?: string
  displayColor?: string
  createdAt: number
  updatedAt: number
  meshCount: number
  nodeCount: number
  triangleCount: number
  size: [number, number, number]
  focusEnabled?: boolean
  importProfile?: Record<string, unknown>
}

const STORAGE_KEY = 'cabinet-components'

function readAll(): ComponentRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeAll(records: ComponentRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
}

export const componentStore = {
  list(): ComponentRecord[] {
    return readAll().sort((a, b) => b.updatedAt - a.updatedAt)
  },

  get(id: string): ComponentRecord | undefined {
    return readAll().find(r => r.id === id)
  },

  save(record: ComponentRecord): void {
    const all = readAll()
    const idx = all.findIndex(r => r.id === record.id)
    if (idx >= 0) all[idx] = record
    else all.push(record)
    writeAll(all)
  },

  remove(id: string): void {
    writeAll(readAll().filter(r => r.id !== id))
  },

  generateId(): string {
    return `component-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }
}

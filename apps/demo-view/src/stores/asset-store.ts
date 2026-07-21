import type { SceneSchema } from '@3d-editor/engine'

export type Layout2DOrigin = 'top-left' | 'center'

export interface Layout2DItem {
  id: string
  componentId: string
  name: string
  xMm: number
  yMm: number
  rotationDeg: number
  widthMm: number
  heightMm: number
  color?: string
  focusEnabled?: boolean
}

export interface Layout2DData {
  board: {
    widthMm: number
    heightMm: number
    gridMm: number
    origin: Layout2DOrigin
  }
  items: Layout2DItem[]
}

export interface AssetRecord {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  storageVersion?: number
  sourceResourceId?: string
  thumbnailResourceId?: string
  stats?: {
    nodeCount: number
    meshCount: number
    triangleCount: number
    size: [number, number, number]
  }
  importProfile?: Record<string, unknown>
  cabinetComponentId?: string
  layout2d?: Layout2DData
  lastUsedMode?: '2d' | '3d'
  sceneData: SceneSchema
}

const STORAGE_KEY = 'cabinet-assets'

function readAll(): AssetRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeAll(records: AssetRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
}

export const assetStore = {
  list(): AssetRecord[] {
    return readAll().sort((a, b) => b.updatedAt - a.updatedAt)
  },

  get(id: string): AssetRecord | undefined {
    return readAll().find(r => r.id === id)
  },

  save(record: AssetRecord): void {
    const all = readAll()
    const idx = all.findIndex(r => r.id === record.id)
    if (idx >= 0) {
      all[idx] = record
    } else {
      all.push(record)
    }
    writeAll(all)
  },

  remove(id: string): void {
    writeAll(readAll().filter(r => r.id !== id))
  },

  generateId(): string {
    return `asset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }
}

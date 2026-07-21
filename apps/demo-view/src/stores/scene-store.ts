import type { SceneSchema } from '@3d-editor/engine'

export interface SceneRecord {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  sceneData: SceneSchema
}

const STORAGE_KEY = 'cabinet-scenes'

function readAll(): SceneRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeAll(records: SceneRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
}

export const sceneStore = {
  list(): SceneRecord[] {
    return readAll().sort((a, b) => b.updatedAt - a.updatedAt)
  },

  get(id: string): SceneRecord | undefined {
    return readAll().find(r => r.id === id)
  },

  save(record: SceneRecord): void {
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
    return `scene-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }
}

import {
  emptyCommBundle,
  type CommBundle,
  type CommPoint,
  type CommSource
} from './comm-types'

const STORAGE_KEY = 'electrical-room:comm:v1'

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

function parseBundle(raw: unknown): CommBundle | null {
  if (!isRecord(raw) || raw.version !== 1 || !Array.isArray(raw.sources)) return null
  return raw as unknown as CommBundle
}

/** 读取通信配置；损坏或缺失时返回空 bundle */
export function loadCommBundle(): CommBundle {
  try {
    const text = localStorage.getItem(STORAGE_KEY)
    if (!text) return emptyCommBundle()
    const parsed = parseBundle(JSON.parse(text) as unknown)
    return parsed ?? emptyCommBundle()
  } catch {
    return emptyCommBundle()
  }
}

export function saveCommBundle(bundle: CommBundle): void {
  const next: CommBundle = {
    version: 1,
    sources: bundle.sources.map(s => ({
      ...s,
      points: s.points.map(p => ({ ...p }))
    }))
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}

export function upsertCommSource(source: CommSource): CommBundle {
  const bundle = loadCommBundle()
  const idx = bundle.sources.findIndex(s => s.id === source.id)
  if (idx >= 0) bundle.sources[idx] = source
  else bundle.sources.push(source)
  saveCommBundle(bundle)
  return bundle
}

export function removeCommSource(sourceId: string): CommBundle {
  const bundle = loadCommBundle()
  bundle.sources = bundle.sources.filter(s => s.id !== sourceId)
  saveCommBundle(bundle)
  return bundle
}

export function upsertCommPoint(sourceId: string, point: CommPoint): CommBundle {
  const bundle = loadCommBundle()
  const source = bundle.sources.find(s => s.id === sourceId)
  if (!source) return bundle
  const idx = source.points.findIndex(p => p.id === point.id)
  if (idx >= 0) source.points[idx] = point
  else source.points.push(point)
  saveCommBundle(bundle)
  return bundle
}

export function removeCommPoint(sourceId: string, pointId: string): CommBundle {
  const bundle = loadCommBundle()
  const source = bundle.sources.find(s => s.id === sourceId)
  if (!source) return bundle
  source.points = source.points.filter(p => p.id !== pointId)
  saveCommBundle(bundle)
  return bundle
}

import * as api from './api'
import {
  emptyCommBundle,
  type CommBundle,
  type CommPoint,
  type CommSource
} from './comm-types'

function cloneBundle(bundle: CommBundle): CommBundle {
  return {
    version: 1,
    sources: bundle.sources.map(s => ({
      ...s,
      points: s.points.map(p => ({ ...p }))
    }))
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

function parseBundle(raw: unknown): CommBundle | null {
  if (!isRecord(raw) || raw.version !== 1 || !Array.isArray(raw.sources)) return null
  return raw as unknown as CommBundle
}

/** 读取站点通信清单；损坏或失败时返回空 bundle */
export async function loadCommBundle(): Promise<CommBundle> {
  try {
    const parsed = parseBundle(await api.getCommBundle())
    return parsed ?? emptyCommBundle()
  } catch {
    return emptyCommBundle()
  }
}

export async function saveCommBundle(bundle: CommBundle): Promise<CommBundle> {
  return api.putCommBundle(cloneBundle(bundle))
}

export async function upsertCommSource(source: CommSource): Promise<CommBundle> {
  const bundle = await loadCommBundle()
  const idx = bundle.sources.findIndex(s => s.id === source.id)
  if (idx >= 0) bundle.sources[idx] = source
  else bundle.sources.push(source)
  return saveCommBundle(bundle)
}

export async function removeCommSource(sourceId: string): Promise<CommBundle> {
  const bundle = await loadCommBundle()
  bundle.sources = bundle.sources.filter(s => s.id !== sourceId)
  return saveCommBundle(bundle)
}

export async function upsertCommPoint(sourceId: string, point: CommPoint): Promise<CommBundle> {
  const bundle = await loadCommBundle()
  const source = bundle.sources.find(s => s.id === sourceId)
  if (!source) return bundle
  const idx = source.points.findIndex(p => p.id === point.id)
  if (idx >= 0) source.points[idx] = point
  else source.points.push(point)
  return saveCommBundle(bundle)
}

export async function removeCommPoint(sourceId: string, pointId: string): Promise<CommBundle> {
  const bundle = await loadCommBundle()
  const source = bundle.sources.find(s => s.id === sourceId)
  if (!source) return bundle
  source.points = source.points.filter(p => p.id !== pointId)
  return saveCommBundle(bundle)
}

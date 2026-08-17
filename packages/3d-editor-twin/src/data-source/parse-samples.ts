import type { PointSample, PointValue } from '../types'
import type { TwinSamplesPayload } from './types'

function isPointValue(v: unknown): v is PointValue {
  return typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean'
}

/** 解析 HTTP / WS / MQTT 统一报文为 PointSample[] */
export function parseSamplesPayload(raw: unknown): PointSample[] {
  if (!raw || typeof raw !== 'object') return []
  const samples = (raw as TwinSamplesPayload).samples
  if (!Array.isArray(samples)) return []
  const out: PointSample[] = []
  for (const item of samples) {
    if (!item || typeof item !== 'object') continue
    const { twinId, key, value, ts } = item
    if (typeof twinId !== 'string' || typeof key !== 'string') continue
    if (!isPointValue(value)) continue
    out.push({
      twinId,
      key,
      value,
      ...(typeof ts === 'number' ? { ts } : {})
    })
  }
  return out
}

export function parseSamplesJson(text: string): PointSample[] {
  try {
    return parseSamplesPayload(JSON.parse(text) as unknown)
  } catch {
    return []
  }
}

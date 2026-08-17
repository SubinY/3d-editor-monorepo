import type { DataSourceNeed, PointSample, PointValue } from '../types'
import type { MapResponseFn, TwinSamplesPayload } from './types'

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

/**
 * 可选 mapResponse → 再 parseSamplesPayload。
 * mapResponse 可返回 TwinSamplesPayload，或原样透传（由 parse 识别）。
 */
export function resolveSamples(
  raw: unknown,
  need: DataSourceNeed[],
  mapResponse?: MapResponseFn
): PointSample[] {
  if (mapResponse) {
    try {
      const mapped = mapResponse(raw, { need })
      return parseSamplesPayload(mapped)
    } catch (err) {
      console.warn('[DataSource] mapResponse failed', err)
      return []
    }
  }
  return parseSamplesPayload(raw)
}

export function resolveSamplesJson(
  text: string,
  need: DataSourceNeed[],
  mapResponse?: MapResponseFn
): PointSample[] {
  try {
    return resolveSamples(JSON.parse(text) as unknown, need, mapResponse)
  } catch {
    return []
  }
}

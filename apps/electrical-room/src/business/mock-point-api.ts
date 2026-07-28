import { BUILTIN_POINT_KEYS, type BuiltinPointKey } from './node-bindings'
import type { PointValueMap } from './point-runtime'

/** 生成一轮随机点位快照（用于 mock HTTP body） */
export function buildRandomPointSnapshot(): PointValueMap {
  const snapshot: PointValueMap = {}
  for (const key of BUILTIN_POINT_KEYS) {
    snapshot[key] = randomValueFor(key)
  }
  return snapshot
}

function randomValueFor(key: BuiltinPointKey): number | string | boolean {
  switch (key) {
    case 'temp':
      return Math.round(20 + Math.random() * 100)
    case 'humidity':
      return Math.round(30 + Math.random() * 60)
    case 'voltage':
      return Math.round(200 + Math.random() * 60)
    case 'current':
      return Math.round(Math.random() * 80 * 10) / 10
    case 'power':
      return Math.round(Math.random() * 50 * 10) / 10
    case 'pressure':
      return Math.round(90 + Math.random() * 40)
    case 'speed':
      return Math.round(Math.random() * 1800)
    case 'status':
      return Math.floor(Math.random() * 4)
    case 'alarm':
      return Math.random() > 0.7 ? 1 : 0
    case 'online':
      return Math.random() > 0.15
    default:
      return 0
  }
}

/**
 * 用 fetch 轮询「假接口」：blob URL + JSON，满足 HTTP fetch 形态。
 * 每次请求生成新随机值。
 */
export async function fetchMockPointValues(): Promise<PointValueMap> {
  const body = JSON.stringify(buildRandomPointSnapshot())
  const blob = new Blob([body], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`mock point fetch failed: ${res.status}`)
    return (await res.json()) as PointValueMap
  } finally {
    URL.revokeObjectURL(url)
  }
}

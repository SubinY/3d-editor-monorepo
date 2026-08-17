import type { MapResponseFn, TwinSamplesPayload } from '@mh/3d-editor-twin'

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

/**
 * 行业常见形态：`[{ dataId, value }, ...]` → TwinSamplesPayload。
 * - dataId 匹配 need.key 或 need.twinId
 * - 否则在仅一个 twin 订阅时，把 dataId 当作 key
 * - 已是 `{ samples: [...] }` 则原样透传
 */
export const mapDataIdRows: MapResponseFn = (raw, ctx) => {
  if (isRecord(raw) && Array.isArray(raw.samples)) {
    return raw as TwinSamplesPayload
  }

  const rows = Array.isArray(raw)
    ? raw
    : isRecord(raw) && Array.isArray(raw.data)
      ? raw.data
      : null
  if (!rows) return raw

  const need = ctx.need
  const samples: TwinSamplesPayload['samples'] = []
  for (const item of rows) {
    if (!isRecord(item)) continue
    const dataId = item.dataId
    const value = item.value
    if (typeof dataId !== 'string') continue

    const byKey = need.find(n => n.key === dataId)
    if (byKey) {
      samples.push({ twinId: byKey.twinId, key: byKey.key, value })
      continue
    }
    const byTwin = need.find(n => n.twinId === dataId)
    if (byTwin) {
      samples.push({ twinId: byTwin.twinId, key: byTwin.key, value })
      continue
    }

    const twinIds = [...new Set(need.map(n => n.twinId))]
    if (twinIds.length === 1) {
      samples.push({ twinId: twinIds[0], key: dataId, value })
    }
  }
  return { samples }
}

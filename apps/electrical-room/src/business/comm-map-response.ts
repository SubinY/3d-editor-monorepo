import type { MapResponseFn, TwinSamplesPayload } from '@mh/3d-editor-twin'

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

/**
 * 行业常见形态 → TwinSamplesPayload。
 * 接受：`{ dataId, value }`、`[{ dataId, value }, ...]`、`{ data: [...] }`。
 * - dataId 匹配 need.key：扇出到所有同 key 订阅（多节点绑同一点位）
 * - 否则匹配 need.twinId
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
      : isRecord(raw) && typeof raw.dataId === 'string'
        ? [raw]
        : null
  if (!rows) return raw

  const need = ctx.need
  const samples: TwinSamplesPayload['samples'] = []
  for (const item of rows) {
    if (!isRecord(item)) continue
    const dataId = item.dataId
    const value = item.value
    if (typeof dataId !== 'string') continue

    const byKey = need.filter(n => n.key === dataId)
    if (byKey.length > 0) {
      for (const n of byKey) {
        samples.push({ twinId: n.twinId, key: n.key, value })
      }
      continue
    }
    const byTwin = need.filter(n => n.twinId === dataId)
    if (byTwin.length > 0) {
      for (const n of byTwin) {
        samples.push({ twinId: n.twinId, key: n.key, value })
      }
      continue
    }

    const twinIds = [...new Set(need.map(n => n.twinId))]
    if (twinIds.length === 1) {
      samples.push({ twinId: twinIds[0], key: dataId, value })
    }
  }
  return { samples }
}

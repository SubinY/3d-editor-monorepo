import type { DataSourceConfig, MapResponseFn } from '@mh/3d-editor-twin'
import { mapDataIdRows } from './comm-map-response'
import type { CommBundle, CommSource } from './comm-types'

function buildWsUrl(scheme: 'ws' | 'wss', host: string): string {
  const h = host.trim().replace(/^(ws|wss):\/\//i, '')
  return `${scheme}://${h}`
}

function parseHeaders(raw?: string): Record<string, string> | undefined {
  if (!raw?.trim()) return undefined
  try {
    const obj = JSON.parse(raw) as unknown
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return undefined
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (typeof v === 'string') out[k] = v
      else if (typeof v === 'number' || typeof v === 'boolean') out[k] = String(v)
    }
    return Object.keys(out).length ? out : undefined
  } catch {
    return undefined
  }
}

function sourceToConfig(
  source: CommSource,
  mapResponse?: MapResponseFn
): DataSourceConfig | null {
  switch (source.protocol) {
    case 'http': {
      if (!source.url.trim()) return null
      return {
        type: 'http',
        url: source.url.trim(),
        method: source.method,
        intervalMs: source.intervalMs > 0 ? source.intervalMs : 2000,
        headers: parseHeaders(source.headersJson),
        ...(mapResponse ? { mapResponse } : {})
      }
    }
    case 'ws': {
      if (!source.host.trim()) return null
      return {
        type: 'ws',
        url: buildWsUrl(source.scheme, source.host),
        ...(mapResponse ? { mapResponse } : {})
      }
    }
    case 'mqtt': {
      if (!source.host.trim()) return null
      const topics = source.topics
        .split(/[,;\s]+/)
        .map(t => t.trim())
        .filter(Boolean)
      if (topics.length === 0) return null
      return {
        type: 'mqtt',
        url: buildWsUrl(source.scheme, source.host),
        topics,
        clientId: source.clientId.trim() || undefined,
        username: source.username?.trim() || undefined,
        password: source.password || undefined,
        ...(mapResponse ? { mapResponse } : {})
      }
    }
    default:
      return null
  }
}

export interface ToDataSourceConfigsOptions {
  /** 默认挂 mapDataIdRows；传 null 关闭 */
  mapResponse?: MapResponseFn | null
}

/** 通信 bundle → Twin DataSourceConfig[]（忽略点位表，只映射连接） */
export function toDataSourceConfigs(
  bundle: CommBundle,
  options?: ToDataSourceConfigsOptions
): DataSourceConfig[] {
  const mapResponse =
    options?.mapResponse === null ? undefined : (options?.mapResponse ?? mapDataIdRows)
  const out: DataSourceConfig[] = []
  for (const s of bundle.sources) {
    const cfg = sourceToConfig(s, mapResponse)
    if (cfg) out.push(cfg)
  }
  return out
}

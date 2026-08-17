import type { DataSourceNeed } from '../types'

export interface TwinSamplesPayload {
  samples: Array<{
    twinId: string
    key: string
    value: unknown
    ts?: number
  }>
}

/**
 * Host 注入：把异形响应转成 TwinSamplesPayload（或可被 parseSamplesPayload 识别的结构）。
 * ctx.need 为当前订阅清单，便于 dataId → twinId/key 对齐。
 */
export type MapResponseFn = (
  raw: unknown,
  ctx: { need: DataSourceNeed[] }
) => TwinSamplesPayload | unknown

export interface HttpSourceConfig {
  type: 'http'
  url: string
  /** 默认 POST */
  method?: 'GET' | 'POST'
  /** 轮询间隔 ms，默认 2000 */
  intervalMs?: number
  headers?: Record<string, string>
  mapResponse?: MapResponseFn
}

export interface WsSourceConfig {
  type: 'ws'
  url: string
  mapResponse?: MapResponseFn
}

export interface MqttSourceConfig {
  type: 'mqtt'
  /** 推荐 ws:// 或 wss:// */
  url: string
  /** 单 topic；与 topics 二选一，topics 优先 */
  topic?: string
  topics?: string[]
  username?: string
  password?: string
  clientId?: string
  mapResponse?: MapResponseFn
}

export type DataSourceConfig = HttpSourceConfig | WsSourceConfig | MqttSourceConfig

export interface SubscribeMessage {
  type: 'subscribe'
  need: DataSourceNeed[]
}

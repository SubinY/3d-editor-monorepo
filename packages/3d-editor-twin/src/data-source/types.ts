import type { DataSourceNeed } from '../types'

export interface TwinSamplesPayload {
  samples: Array<{
    twinId: string
    key: string
    value: unknown
    ts?: number
  }>
}

export interface HttpSourceConfig {
  type: 'http'
  url: string
  /** 默认 POST */
  method?: 'GET' | 'POST'
  /** 轮询间隔 ms，默认 2000 */
  intervalMs?: number
  headers?: Record<string, string>
}

export interface WsSourceConfig {
  type: 'ws'
  url: string
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
}

export type DataSourceConfig = HttpSourceConfig | WsSourceConfig | MqttSourceConfig

export interface SubscribeMessage {
  type: 'subscribe'
  need: DataSourceNeed[]
}

/** 站点通信清单 DTO（Host 经 GET/PUT /api/comm 落盘，不进 Document） */

export type CommProtocol = 'mqtt' | 'ws' | 'http'

export interface CommPoint {
  id: string
  name: string
  key: string
}

interface CommSourceBase {
  id: string
  name: string
  points: CommPoint[]
}

export interface CommHttpSource extends CommSourceBase {
  protocol: 'http'
  url: string
  method: 'GET' | 'POST'
  intervalMs: number
  headersJson?: string
}

export interface CommWsSource extends CommSourceBase {
  protocol: 'ws'
  scheme: 'ws' | 'wss'
  host: string
  protocols?: string
}

export interface CommMqttSource extends CommSourceBase {
  protocol: 'mqtt'
  scheme: 'ws' | 'wss'
  host: string
  topics: string
  clientId: string
  username?: string
  password?: string
}

export type CommSource = CommHttpSource | CommWsSource | CommMqttSource

export interface CommBundle {
  version: 1
  sources: CommSource[]
}

export const COMM_PROTOCOLS: CommProtocol[] = ['mqtt', 'ws', 'http']

export const COMM_PROTOCOL_LABEL: Record<CommProtocol, string> = {
  mqtt: 'MQTT',
  ws: 'WebSocket',
  http: 'HTTP'
}

export function emptyCommBundle(): CommBundle {
  return { version: 1, sources: [] }
}

export function createCommId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

import mqtt from 'mqtt'
import type { MqttClient } from 'mqtt'
import type { DataSource, DataSourceNeed, PointSample } from '../types'
import { parseSamplesJson, parseSamplesPayload } from './parse-samples'
import type { MqttSourceConfig } from './types'

function resolveTopics(config: Omit<MqttSourceConfig, 'type'>): string[] {
  if (config.topics?.length) return [...config.topics]
  if (config.topic) return [config.topic]
  return []
}

export class MqttDataSource implements DataSource {
  private need: DataSourceNeed[] = []
  private listeners = new Set<(samples: PointSample[]) => void>()
  private client: MqttClient | undefined
  private readonly config: Omit<MqttSourceConfig, 'type'>
  private readonly topics: string[]

  constructor(config: Omit<MqttSourceConfig, 'type'>) {
    this.config = config
    this.topics = resolveTopics(config)
    if (this.topics.length === 0) {
      console.warn('[MqttDataSource] no topic configured')
    }
  }

  start(need: DataSourceNeed[]): void {
    this.need = need.map(n => ({ ...n }))
    if (this.need.length === 0) {
      this.disconnect()
      return
    }
    if (this.client?.connected) return
    this.connect()
  }

  stop(): void {
    this.need = []
    this.disconnect()
  }

  subscribe(onBatch: (samples: PointSample[]) => void): () => void {
    this.listeners.add(onBatch)
    return () => {
      this.listeners.delete(onBatch)
    }
  }

  private connect(): void {
    this.disconnect()
    if (this.topics.length === 0) return

    const client = mqtt.connect(this.config.url, {
      username: this.config.username,
      password: this.config.password,
      clientId: this.config.clientId,
      reconnectPeriod: 2000
    })
    this.client = client

    client.on('connect', () => {
      for (const topic of this.topics) {
        client.subscribe(topic, err => {
          if (err) console.warn('[MqttDataSource] subscribe failed', topic, err)
        })
      }
    })

    client.on('message', (_topic, payload) => {
      const text = payload.toString()
      let samples = parseSamplesJson(text)
      if (samples.length === 0) {
        try {
          samples = parseSamplesPayload(JSON.parse(text) as unknown)
        } catch {
          return
        }
      }
      if (samples.length === 0 || this.listeners.size === 0) return
      // 若报文带 twinId/key，直接推；否则不按 need 过滤（由上游保证）
      for (const listener of this.listeners) listener(samples)
    })

    client.on('error', err => {
      console.warn('[MqttDataSource] error', err)
    })
  }

  private disconnect(): void {
    if (!this.client) return
    try {
      this.client.end(true)
    } catch {
      /* ignore */
    }
    this.client = undefined
  }
}

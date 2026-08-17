import mqtt from 'mqtt'
import type { MqttClient } from 'mqtt'
import type { DataSource, DataSourceNeed, PointSample } from '../types'
import { resolveSamplesJson } from './parse-samples'
import type { MapResponseFn, MqttSourceConfig } from './types'

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
  private readonly mapResponse: MapResponseFn | undefined

  constructor(config: Omit<MqttSourceConfig, 'type'>) {
    this.config = config
    this.topics = resolveTopics(config)
    this.mapResponse = config.mapResponse
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
      const samples = resolveSamplesJson(text, this.need, this.mapResponse)
      if (samples.length === 0 || this.listeners.size === 0) return
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

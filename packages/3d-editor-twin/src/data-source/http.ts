import type { DataSource, DataSourceNeed, PointSample } from '../types'
import { resolveSamples } from './parse-samples'
import type { HttpSourceConfig, MapResponseFn } from './types'

export class HttpDataSource implements DataSource {
  private need: DataSourceNeed[] = []
  private listeners = new Set<(samples: PointSample[]) => void>()
  private timer: ReturnType<typeof setInterval> | undefined
  private readonly url: string
  private readonly method: 'GET' | 'POST'
  private readonly intervalMs: number
  private readonly headers: Record<string, string>
  private readonly mapResponse: MapResponseFn | undefined
  private inFlight = false

  constructor(config: Omit<HttpSourceConfig, 'type'>) {
    this.url = config.url
    this.method = config.method ?? 'POST'
    this.intervalMs = config.intervalMs ?? 2000
    this.headers = config.headers ?? {}
    this.mapResponse = config.mapResponse
  }

  start(need: DataSourceNeed[]): void {
    this.need = need.map(n => ({ ...n }))
    this.stopTimer()
    if (this.need.length === 0) return
    void this.poll()
    this.timer = setInterval(() => {
      void this.poll()
    }, this.intervalMs)
  }

  stop(): void {
    this.stopTimer()
    this.need = []
  }

  subscribe(onBatch: (samples: PointSample[]) => void): () => void {
    this.listeners.add(onBatch)
    return () => {
      this.listeners.delete(onBatch)
    }
  }

  private stopTimer(): void {
    if (this.timer !== undefined) {
      clearInterval(this.timer)
      this.timer = undefined
    }
  }

  private async poll(): Promise<void> {
    if (this.inFlight || this.need.length === 0 || this.listeners.size === 0) return
    this.inFlight = true
    try {
      const init: RequestInit = {
        method: this.method,
        headers: {
          Accept: 'application/json',
          ...this.headers
        }
      }
      let url = this.url
      if (this.method === 'POST') {
        init.headers = {
          ...init.headers,
          'Content-Type': 'application/json'
        }
        init.body = JSON.stringify({ need: this.need })
      } else {
        const base =
          typeof location !== 'undefined' ? location.origin : 'http://localhost'
        const u = new URL(this.url, base)
        u.searchParams.set('need', JSON.stringify(this.need))
        url = u.toString()
      }
      const res = await fetch(url, init)
      if (!res.ok) {
        console.warn('[HttpDataSource] HTTP', res.status, res.statusText)
        return
      }
      const body: unknown = await res.json()
      const samples = resolveSamples(body, this.need, this.mapResponse)
      if (samples.length === 0) return
      for (const listener of this.listeners) listener(samples)
    } catch (err) {
      console.warn('[HttpDataSource] poll failed', err)
    } finally {
      this.inFlight = false
    }
  }
}

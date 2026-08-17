import type { DataSource, DataSourceNeed, PointSample } from '../types'
import { parseSamplesJson } from './parse-samples'
import type { WsSourceConfig } from './types'

export class WsDataSource implements DataSource {
  private need: DataSourceNeed[] = []
  private listeners = new Set<(samples: PointSample[]) => void>()
  private socket: WebSocket | undefined
  private readonly url: string
  private intentionallyClosed = false

  constructor(config: Omit<WsSourceConfig, 'type'>) {
    this.url = config.url
  }

  start(need: DataSourceNeed[]): void {
    this.need = need.map(n => ({ ...n }))
    if (this.need.length === 0) {
      this.closeSocket()
      return
    }
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.sendSubscribe()
      return
    }
    if (this.socket && this.socket.readyState === WebSocket.CONNECTING) {
      return
    }
    this.openSocket()
  }

  stop(): void {
    this.need = []
    this.closeSocket()
  }

  subscribe(onBatch: (samples: PointSample[]) => void): () => void {
    this.listeners.add(onBatch)
    return () => {
      this.listeners.delete(onBatch)
    }
  }

  private openSocket(): void {
    if (this.socket) {
      try {
        this.socket.onclose = null
        this.socket.close()
      } catch {
        /* ignore */
      }
      this.socket = undefined
    }
    this.intentionallyClosed = false
    const ws = new WebSocket(this.url)
    this.socket = ws
    ws.onopen = () => {
      if (this.socket !== ws) return
      this.sendSubscribe()
    }
    ws.onmessage = ev => {
      if (typeof ev.data !== 'string') return
      const samples = parseSamplesJson(ev.data)
      if (samples.length === 0 || this.listeners.size === 0) return
      for (const listener of this.listeners) listener(samples)
    }
    ws.onerror = () => {
      console.warn('[WsDataSource] socket error')
    }
    ws.onclose = () => {
      if (this.socket === ws) this.socket = undefined
      if (!this.intentionallyClosed && this.need.length > 0) {
        setTimeout(() => {
          if (!this.intentionallyClosed && this.need.length > 0 && !this.socket) {
            this.openSocket()
          }
        }, 2000)
      }
    }
  }

  private sendSubscribe(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return
    this.socket.send(JSON.stringify({ type: 'subscribe', need: this.need }))
  }

  private closeSocket(): void {
    this.intentionallyClosed = true
    if (!this.socket) return
    try {
      this.socket.onclose = null
      this.socket.close()
    } catch {
      /* ignore */
    }
    this.socket = undefined
  }
}

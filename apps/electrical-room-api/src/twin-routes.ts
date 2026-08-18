/**
 * 孪生点位模拟：HTTP 轮询 + WebSocket 推送（不内嵌 MQTT broker）。
 */
import type { Express, Request } from 'express'
import type { Server as HttpServer } from 'node:http'
import { WebSocketServer, type WebSocket } from 'ws'
import { asyncRoute } from './http.js'

export type TwinNeed = { twinId: string; key: string; source?: string }

export type TwinSample = {
  twinId: string
  key: string
  value: number | string | boolean
  ts: number
}

function randomValueFor(key: string): number | string | boolean {
  switch (key) {
    case 'temp':
      return Math.round(20 + Math.random() * 100)
    case 'humidity':
      return Math.round(30 + Math.random() * 60)
    case 'voltage':
      return Math.round(200 + Math.random() * 60)
    case 'current':
      return Math.round(Math.random() * 80 * 10) / 10
    case 'power':
      return Math.round(Math.random() * 50 * 10) / 10
    case 'pressure':
      return Math.round(90 + Math.random() * 40)
    case 'speed':
      return Math.round(Math.random() * 1800)
    case 'status':
      return Math.floor(Math.random() * 4)
    case 'alarm':
      return Math.random() > 0.7 ? 1 : 0
    case 'online':
      return Math.random() > 0.15
    default:
      return Math.round(Math.random() * 100)
  }
}

function isNeedItem(v: unknown): v is TwinNeed {
  if (!v || typeof v !== 'object') return false
  const o = v as TwinNeed
  return typeof o.twinId === 'string' && typeof o.key === 'string'
}

function parseNeed(raw: unknown): TwinNeed[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(isNeedItem).map(n => ({
    twinId: n.twinId,
    key: n.key,
    ...(typeof n.source === 'string' ? { source: n.source } : {})
  }))
}

export function buildSamples(need: TwinNeed[]): TwinSample[] {
  const ts = Date.now()
  return need.map(n => ({
    twinId: n.twinId,
    key: n.key,
    value: randomValueFor(n.key),
    ts
  }))
}

function parseNeedFromQuery(req: Request): TwinNeed[] {
  const q = req.query.need
  if (typeof q !== 'string' || !q) return []
  try {
    return parseNeed(JSON.parse(q) as unknown)
  } catch {
    return []
  }
}

export function registerTwinHttpRoutes(app: Express): void {
  app.get(
    '/api/twin/points',
    asyncRoute(async (req, res) => {
      const need = parseNeedFromQuery(req)
      res.json({ samples: buildSamples(need) })
    })
  )

  app.post(
    '/api/twin/points',
    asyncRoute(async (req, res) => {
      const body = req.body as { need?: unknown } | null
      const need = parseNeed(body?.need)
      res.json({ samples: buildSamples(need) })
    })
  )
}

type ClientState = {
  need: TwinNeed[]
  timer: ReturnType<typeof setInterval> | undefined
}

const INTERVAL_MS = 2000

function pushToClient(ws: WebSocket, state: ClientState): void {
  if (ws.readyState !== ws.OPEN || state.need.length === 0) return
  ws.send(JSON.stringify({ samples: buildSamples(state.need) }))
}

export function attachTwinWebSocket(server: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/api/twin/ws' })

  wss.on('connection', (ws: WebSocket) => {
    const state: ClientState = { need: [], timer: undefined }

    const clearTimer = () => {
      if (state.timer !== undefined) {
        clearInterval(state.timer)
        state.timer = undefined
      }
    }

    const restartPush = () => {
      clearTimer()
      if (state.need.length === 0) return
      pushToClient(ws, state)
      state.timer = setInterval(() => pushToClient(ws, state), INTERVAL_MS)
    }

    ws.on('message', raw => {
      let parsed: unknown
      try {
        parsed = JSON.parse(String(raw))
      } catch {
        return
      }
      if (!parsed || typeof parsed !== 'object') return
      const msg = parsed as { type?: string; need?: unknown }
      if (msg.type !== 'subscribe') return
      state.need = parseNeed(msg.need)
      restartPush()
    })

    ws.on('close', () => clearTimer())
    ws.on('error', () => clearTimer())
  })

  return wss
}

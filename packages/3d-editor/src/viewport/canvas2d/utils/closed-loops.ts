/** 从线段墙端点聚类建图，提取封闭环多边形（纯函数） */
import type { WallJSON } from '../../../document/types'
import type { PlanePoint } from '../types'
import { ENDPOINT_SNAP } from '../types'

export interface ClosedLoop {
  /** 有序顶点（闭合前不重复首点） */
  points: PlanePoint[]
  area: number
}

interface LoopCandidate {
  vertexIds: number[]
  points: PlanePoint[]
  area: number
}

/**
 * 找出墙段构成的封闭环。
 * 端点聚类 → 平面图绕行取面 → 按连通分量去掉各自外轮廓（避免多房间时误删最大房间）。
 */
export function findClosedWallLoops(
  walls: WallJSON[],
  snap = ENDPOINT_SNAP
): ClosedLoop[] {
  if (walls.length < 3) return []

  const points: PlanePoint[] = []
  const vertexOf = (u: number, v: number): number => {
    for (let i = 0; i < points.length; i++) {
      if (Math.hypot(points[i].u - u, points[i].v - v) <= snap) return i
    }
    points.push({ u, v })
    return points.length - 1
  }

  type Half = { to: number; angle: number }
  const adj = new Map<number, Half[]>()
  const addEdge = (a: number, b: number) => {
    if (a === b) return
    const listA = adj.get(a) ?? []
    const listB = adj.get(b) ?? []
    listA.push({ to: b, angle: Math.atan2(points[b].v - points[a].v, points[b].u - points[a].u) })
    listB.push({ to: a, angle: Math.atan2(points[a].v - points[b].v, points[a].u - points[b].u) })
    adj.set(a, listA)
    adj.set(b, listB)
  }

  walls.forEach(wall => {
    addEdge(vertexOf(wall.a[0], wall.a[1]), vertexOf(wall.b[0], wall.b[1]))
  })

  for (const [, list] of adj) {
    list.sort((x, y) => x.angle - y.angle)
  }

  const used = new Set<string>()
  const dirKey = (from: number, to: number) => `${from}>${to}`

  const nextVertex = (curr: number, prev: number): number | undefined => {
    const list = adj.get(curr)
    if (!list?.length) return undefined
    const incoming = Math.atan2(points[prev].v - points[curr].v, points[prev].u - points[curr].u)
    let bestIdx = 0
    let bestDelta = Infinity
    list.forEach((h, idx) => {
      let delta = h.angle - incoming
      while (delta <= 1e-9) delta += Math.PI * 2
      while (delta > Math.PI * 2 + 1e-9) delta -= Math.PI * 2
      if (delta < bestDelta) {
        bestDelta = delta
        bestIdx = idx
      }
    })
    return list[bestIdx]?.to
  }

  const raw: LoopCandidate[] = []
  for (const [start, neigh] of adj) {
    for (const { to: first } of neigh) {
      if (used.has(dirKey(start, first))) continue
      const face: number[] = [start]
      let prev = start
      let curr = first
      used.add(dirKey(prev, curr))
      let guard = 0
      let closed = false
      while (guard++ < 512) {
        if (curr === start) {
          closed = true
          break
        }
        face.push(curr)
        const next = nextVertex(curr, prev)
        if (next === undefined) break
        if (used.has(dirKey(curr, next))) break
        used.add(dirKey(curr, next))
        prev = curr
        curr = next
      }
      if (!closed || face.length < 3) continue
      const facePts = face.map(i => points[i])
      const area = signedArea(facePts)
      if (Math.abs(area) < 1e-4) continue
      const orderedIds = area < 0 ? [...face].reverse() : [...face]
      const pts = orderedIds.map(i => ({ ...points[i] }))
      raw.push({
        vertexIds: orderedIds,
        points: pts,
        area: Math.abs(area)
      })
    }
  }

  // 去重（同一环正反绕行）
  const unique: LoopCandidate[] = []
  const seen = new Set<string>()
  for (const loop of raw) {
    const key = [...loop.vertexIds].sort((a, b) => a - b).join(',')
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(loop)
  }
  if (!unique.length) return []

  // 图连通分量
  const compOf = new Map<number, number>()
  let compCount = 0
  for (const start of adj.keys()) {
    if (compOf.has(start)) continue
    const queue = [start]
    compOf.set(start, compCount)
    while (queue.length) {
      const v = queue.pop()!
      for (const { to } of adj.get(v) ?? []) {
        if (compOf.has(to)) continue
        compOf.set(to, compCount)
        queue.push(to)
      }
    }
    compCount++
  }

  // 每个连通分量内：多面时丢掉面积最大的外轮廓；单面（独立房间）直接保留
  const byComp = new Map<number, LoopCandidate[]>()
  for (const loop of unique) {
    const cid = compOf.get(loop.vertexIds[0])
    if (cid === undefined) continue
    const list = byComp.get(cid) ?? []
    list.push(loop)
    byComp.set(cid, list)
  }

  const result: ClosedLoop[] = []
  for (const group of byComp.values()) {
    if (group.length === 1) {
      result.push({ points: group[0].points, area: group[0].area })
      continue
    }
    const maxArea = Math.max(...group.map(l => l.area))
    group.forEach(l => {
      if (l.area < maxArea * 0.999) {
        result.push({ points: l.points, area: l.area })
      }
    })
  }
  return result
}

function signedArea(pts: PlanePoint[]): number {
  let sum = 0
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    sum += a.u * b.v - b.u * a.v
  }
  return sum / 2
}

/** 墙端点吸附、最近墙查询、fixture 贴墙姿态、墙拖联动（纯函数） */
import type { CatalogItem } from '../../../catalog/types'
import type { WallJSON } from '../../../document/types'
import type { PlanePoint } from '../types'
import { ENDPOINT_SNAP, FIXTURE_SNAP, WALL_POINT_SNAP } from '../types'

export function snapWallPoint(
  u: number,
  v: number,
  walls: WallJSON[],
  chainLast: PlanePoint | null
): PlanePoint {
  let best: PlanePoint & { dist: number } | undefined
  const consider = (pu: number, pv: number) => {
    const dist = Math.hypot(pu - u, pv - v)
    if (dist < ENDPOINT_SNAP && (!best || dist < best.dist)) {
      best = { u: pu, v: pv, dist }
    }
  }
  walls.forEach(wall => {
    consider(wall.a[0], wall.a[1])
    consider(wall.b[0], wall.b[1])
  })
  if (chainLast) consider(chainLast.u, chainLast.v)
  if (best) return { u: best.u, v: best.v }
  return {
    u: Math.round(u / WALL_POINT_SNAP) * WALL_POINT_SNAP,
    v: Math.round(v / WALL_POINT_SNAP) * WALL_POINT_SNAP
  }
}

export function nearestWall(
  u: number,
  v: number,
  walls: WallJSON[]
): { wall: WallJSON; pu: number; pv: number; dist: number } | undefined {
  let best: { wall: WallJSON; pu: number; pv: number; dist: number } | undefined
  walls.forEach(wall => {
    const [ax, az] = wall.a
    const [bx, bz] = wall.b
    const dx = bx - ax
    const dz = bz - az
    const lenSq = dx * dx + dz * dz
    if (lenSq < 1e-8) return
    let t = ((u - ax) * dx + (v - az) * dz) / lenSq
    t = Math.min(1, Math.max(0, t))
    const pu = ax + t * dx
    const pv = az + t * dz
    const dist = Math.hypot(u - pu, v - pv)
    if (!best || dist < best.dist) best = { wall, pu, pv, dist }
  })
  return best
}

export function resolveFixturePose(
  item: CatalogItem,
  u: number,
  v: number,
  walls: WallJSON[],
  isElevation: boolean
): { u: number; v: number; yaw: number } {
  if (!isElevation && item.category === 'fixture') {
    const near = nearestWall(u, v, walls)
    if (near && near.dist < FIXTURE_SNAP) {
      const yaw = -Math.atan2(near.wall.b[1] - near.wall.a[1], near.wall.b[0] - near.wall.a[0])
      return { u: near.pu, v: near.pv, yaw }
    }
  }
  return { u, v, yaw: 0 }
}

export type WallDragMode = 'body' | 'a' | 'b'

export interface WallDragPatch {
  id: string
  a: [number, number]
  b: [number, number]
}

/** 墙身平移或拖端点；同簇端点联动。返回受影响墙的完整 a/b */
export function applyWallDrag(
  walls: WallJSON[],
  wallId: string,
  mode: WallDragMode,
  du: number,
  dv: number,
  snap = ENDPOINT_SNAP
): WallDragPatch[] {
  const target = walls.find(w => w.id === wallId)
  if (!target) return []

  const anchors: Array<[number, number]> =
    mode === 'body' ? [target.a, target.b] : mode === 'a' ? [target.a] : [target.b]

  const near = (p: [number, number], anchor: [number, number]) =>
    Math.hypot(p[0] - anchor[0], p[1] - anchor[1]) <= snap

  const patches: WallDragPatch[] = []
  walls.forEach(wall => {
    let a: [number, number] = [...wall.a]
    let b: [number, number] = [...wall.b]
    let changed = false
    for (const anchor of anchors) {
      if (near(wall.a, anchor)) {
        a = [wall.a[0] + du, wall.a[1] + dv]
        changed = true
      }
      if (near(wall.b, anchor)) {
        b = [wall.b[0] + du, wall.b[1] + dv]
        changed = true
      }
    }
    if (changed) patches.push({ id: wall.id, a, b })
  })
  return patches
}

/** 端点优先于墙身；elevation 无墙 */
export function hitWallDragTarget(
  walls: WallJSON[],
  u: number,
  v: number,
  scale: number,
  isElevation: boolean
): { wallId: string; mode: WallDragMode } | undefined {
  if (isElevation || !walls.length) return undefined
  const epThresh = Math.max(0.15, 12 / scale)

  let bestEp: { wallId: string; mode: 'a' | 'b'; dist: number } | undefined
  walls.forEach(wall => {
    const da = Math.hypot(u - wall.a[0], v - wall.a[1])
    const db = Math.hypot(u - wall.b[0], v - wall.b[1])
    if (da <= epThresh && (!bestEp || da < bestEp.dist)) {
      bestEp = { wallId: wall.id, mode: 'a', dist: da }
    }
    if (db <= epThresh && (!bestEp || db < bestEp.dist)) {
      bestEp = { wallId: wall.id, mode: 'b', dist: db }
    }
  })
  if (bestEp) return { wallId: bestEp.wallId, mode: bestEp.mode }

  const near = nearestWall(u, v, walls)
  if (!near) return undefined
  const grab = Math.max((near.wall.thickness ?? 0.2) / 2 + 0.1, 6 / scale)
  if (near.dist > grab) return undefined
  return { wallId: near.wall.id, mode: 'body' }
}

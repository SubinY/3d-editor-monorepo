/** 墙端点吸附、最近墙查询、fixture 贴墙姿态（纯函数） */
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

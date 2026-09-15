/** 点是否在多边形内（射线法）；outline 俯视 [u,v] */
export function pointInPolygon(
  u: number,
  v: number,
  outline: [number, number][]
): boolean {
  if (outline.length < 3) return false
  let inside = false
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const ui = outline[i][0]
    const vi = outline[i][1]
    const uj = outline[j][0]
    const vj = outline[j][1]
    const intersect =
      vi > v !== vj > v && u < ((uj - ui) * (v - vi)) / (vj - vi + 1e-12) + ui
    if (intersect) inside = !inside
  }
  return inside
}

/** 自上而下找命中的工作区（后添加优先） */
export function hitWorkspace(
  workspaces: Array<{ id: string; outline: [number, number][] }>,
  u: number,
  v: number
): string | undefined {
  for (let i = workspaces.length - 1; i >= 0; i--) {
    if (pointInPolygon(u, v, workspaces[i].outline)) return workspaces[i].id
  }
  return undefined
}

/** 命中工作区顶点（阈值随缩放，对齐墙端点） */
export function hitWorkspaceVertex(
  workspaces: Array<{ id: string; outline: [number, number][] }>,
  u: number,
  v: number,
  scale: number
): { workspaceId: string; vertexIndex: number } | undefined {
  if (!workspaces.length) return undefined
  const thresh = Math.max(0.15, 12 / scale)
  let best: { workspaceId: string; vertexIndex: number; dist: number } | undefined
  for (let wi = workspaces.length - 1; wi >= 0; wi--) {
    const ws = workspaces[wi]
    for (let i = 0; i < ws.outline.length; i++) {
      const [ou, ov] = ws.outline[i]
      const dist = Math.hypot(u - ou, v - ov)
      if (dist <= thresh && (!best || dist < best.dist)) {
        best = { workspaceId: ws.id, vertexIndex: i, dist }
      }
    }
  }
  return best
    ? { workspaceId: best.workspaceId, vertexIndex: best.vertexIndex }
    : undefined
}

export interface WorkspaceEdgeHit {
  edgeIndex: number
  /** 边上参数，开区间约 (0,1)，避开端点 */
  t: number
  point: [number, number]
}

/**
 * 命中多边形边（投影点）；过近端点则忽略，避免叠点。
 * `scale` 为相机像素/米，阈值对齐墙身抓取。
 */
export function hitWorkspaceEdge(
  outline: [number, number][],
  u: number,
  v: number,
  scale: number
): WorkspaceEdgeHit | undefined {
  if (outline.length < 3) return undefined
  const thresh = Math.max(0.15, 10 / scale)
  const endEps = 0.02
  let best: (WorkspaceEdgeHit & { dist: number }) | undefined
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i]
    const b = outline[(i + 1) % outline.length]
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const lenSq = dx * dx + dy * dy
    if (lenSq < 1e-8) continue
    let t = ((u - a[0]) * dx + (v - a[1]) * dy) / lenSq
    if (t <= endEps || t >= 1 - endEps) continue
    const pu = a[0] + t * dx
    const pv = a[1] + t * dy
    const dist = Math.hypot(u - pu, v - pv)
    if (dist <= thresh && (!best || dist < best.dist)) {
      best = { edgeIndex: i, t, point: [pu, pv], dist }
    }
  }
  return best
    ? { edgeIndex: best.edgeIndex, t: best.t, point: best.point }
    : undefined
}

/** 在边 edgeIndex 上按 t 插入顶点，返回新 outline */
export function insertOutlineVertex(
  outline: [number, number][],
  edgeIndex: number,
  t: number
): [number, number][] {
  if (outline.length < 3) return outline.map(p => [...p] as [number, number])
  const i = ((edgeIndex % outline.length) + outline.length) % outline.length
  const a = outline[i]
  const b = outline[(i + 1) % outline.length]
  const tt = Math.min(1, Math.max(0, t))
  const point: [number, number] = [a[0] + (b[0] - a[0]) * tt, a[1] + (b[1] - a[1]) * tt]
  const next = outline.map(p => [...p] as [number, number])
  next.splice(i + 1, 0, point)
  return next
}

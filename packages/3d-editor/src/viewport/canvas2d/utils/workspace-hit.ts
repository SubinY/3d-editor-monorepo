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

import type { CatalogItem } from '../catalog/types'
import type { DocumentKind, EditorNodeJSON, TransformJSON } from './types'

/**
 * MVP 碰撞：
 * - scene：俯视 XZ（footprint width×depth）
 * - container：立面 XY（footprint width×height，柜内「长×高」平面）
 * 同层级节点间检测；墙体不参与。
 */

export type CollisionPlane = 'xz' | 'xy'

export interface AABB {
  minU: number
  maxU: number
  minV: number
  maxV: number
}

/** footprint 两轴 + 平面内转角 → 旋转后包围半径 */
export function footprintExtents(
  sizeU: number,
  sizeV: number,
  angle: number
): { eu: number; ev: number } {
  const cos = Math.abs(Math.cos(angle))
  const sin = Math.abs(Math.sin(angle))
  return {
    eu: (sizeU / 2) * cos + (sizeV / 2) * sin,
    ev: (sizeU / 2) * sin + (sizeV / 2) * cos
  }
}

export function planeForKind(kind: DocumentKind): CollisionPlane {
  return kind === 'container' ? 'xy' : 'xz'
}

export function nodeAABB(
  transform: TransformJSON,
  item: CatalogItem | undefined,
  plane: CollisionPlane = 'xz'
): AABB | undefined {
  if (!item) return undefined
  if (plane === 'xy') {
    const sizeU = item.footprint.width
    const sizeV = item.footprint.height ?? item.footprint.depth
    const { eu, ev } = footprintExtents(sizeU, sizeV, transform.rotation[2] ?? 0)
    const [x, y] = transform.position
    // position.y 约定为元件底边高度；碰撞盒按立面中心抬高半高
    const cy = y + sizeV / 2
    return { minU: x - eu, maxU: x + eu, minV: cy - ev, maxV: cy + ev }
  }
  const { eu, ev } = footprintExtents(item.footprint.width, item.footprint.depth, transform.rotation[1])
  const [x, , z] = transform.position
  return { minU: x - eu, maxU: x + eu, minV: z - ev, maxV: z + ev }
}

export function aabbOverlap(a: AABB, b: AABB, tolerance = 1e-4): boolean {
  return (
    a.minU < b.maxU - tolerance &&
    a.maxU > b.minU + tolerance &&
    a.minV < b.maxV - tolerance &&
    a.maxV > b.minV + tolerance
  )
}

export interface CollisionHit {
  nodeId: string
  nodeName?: string
}

export function findCollision(
  siblings: EditorNodeJSON[],
  transform: TransformJSON,
  item: CatalogItem | undefined,
  excludeId: string | undefined,
  resolveItem: (node: EditorNodeJSON) => CatalogItem | undefined,
  plane: CollisionPlane = 'xz'
): CollisionHit | undefined {
  const box = nodeAABB(transform, item, plane)
  if (!box) return undefined
  for (const other of siblings) {
    if (other.id === excludeId) continue
    const otherBox = nodeAABB(other.transform, resolveItem(other), plane)
    if (!otherBox) continue
    if (aabbOverlap(box, otherBox)) {
      return { nodeId: other.id, nodeName: other.name }
    }
  }
  return undefined
}

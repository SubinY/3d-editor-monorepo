import type { CatalogItem, FootprintSpec } from '../catalog/types'
import type { DocumentKind, EditorNodeJSON, TransformJSON } from './types'

/**
 * MVP 碰撞：
 * - scene：俯视 XZ（footprint width×depth×height 经三轴旋转后投影）
 * - container：立面 XY（同上，投影到 XY）
 * 同层级节点间检测；墙体不参与。
 */

export type CollisionPlane = 'xz' | 'xy'

export interface AABB {
  minU: number
  maxU: number
  minV: number
  maxV: number
}

/**
 * OBB → 平面 AABB 投影半径（SAT / 旋转矩阵行绝对值）。
 * Euler XYZ（与 Three.js Object3D.rotation 一致）。
 */
export function rotatedExtents(
  footprint: FootprintSpec,
  rotation: [number, number, number],
  plane: CollisionPlane
): { eu: number; ev: number } {
  const hw = footprint.width / 2
  const hh = (footprint.height ?? footprint.depth) / 2
  const hd = footprint.depth / 2
  const [rx, ry, rz] = rotation
  const cx = Math.cos(rx)
  const sx = Math.sin(rx)
  const cy = Math.cos(ry)
  const sy = Math.sin(ry)
  const cz = Math.cos(rz)
  const sz = Math.sin(rz)

  // R = Rz * Ry * Rx（Three.js 默认 Euler 'XYZ' 的矩阵元素）
  const r00 = cy * cz
  const r01 = sx * sy * cz - cx * sz
  const r02 = cx * sy * cz + sx * sz
  const r10 = cy * sz
  const r11 = sx * sy * sz + cx * cz
  const r12 = cx * sy * sz - sx * cz
  const r20 = -sy
  const r21 = sx * cy
  const r22 = cx * cy

  if (plane === 'xy') {
    return {
      eu: Math.abs(r00) * hw + Math.abs(r01) * hh + Math.abs(r02) * hd,
      ev: Math.abs(r10) * hw + Math.abs(r11) * hh + Math.abs(r12) * hd
    }
  }
  return {
    eu: Math.abs(r00) * hw + Math.abs(r01) * hh + Math.abs(r02) * hd,
    ev: Math.abs(r20) * hw + Math.abs(r21) * hh + Math.abs(r22) * hd
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
  const { eu, ev } = rotatedExtents(item.footprint, transform.rotation, plane)
  if (plane === 'xy') {
    const sizeV = item.footprint.height ?? item.footprint.depth
    const [x, y] = transform.position
    // position.y 约定为元件底边高度；碰撞盒按立面中心抬高半高
    const cy = y + sizeV / 2
    return { minU: x - eu, maxU: x + eu, minV: cy - ev, maxV: cy + ev }
  }
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

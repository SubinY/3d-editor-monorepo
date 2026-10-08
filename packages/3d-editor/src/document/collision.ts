import type { CatalogItem, FootprintSpec } from '../catalog/types'
import type { EditorNodeJSON, TransformJSON } from './types'

/**
 * 碰撞：优先用视口量到的可见网格盒（根局部、未变换），否则退回 footprint 整盒。
 * 旋转和缩放都绕 footprint 几何中心（与 3D 枢轴一致）。
 * position 是底面中心。同层级节点间检测；墙体不参与。
 * rotatedExtents 只给 2D 绘制 / 点选 / 边界投影，不参与碰撞结论。
 */

export type CollisionPlane = 'xz' | 'xy'

const OVERLAP_TOLERANCE = 1e-4

type Vec3 = [number, number, number]

interface OBB {
  center: Vec3
  axes: [Vec3, Vec3, Vec3]
  half: Vec3
}

interface WorldAabb {
  min: Vec3
  max: Vec3
}

/** 节点根局部、未做节点旋转/缩放时的可见网格 AABB。 */
export interface MeshBounds {
  min: Vec3
  max: Vec3
}

function rotationMatrix(rotation: [number, number, number]) {
  const [rx, ry, rz] = rotation
  const cx = Math.cos(rx)
  const sx = Math.sin(rx)
  const cy = Math.cos(ry)
  const sy = Math.sin(ry)
  const cz = Math.cos(rz)
  const sz = Math.sin(rz)
  // R = Rz * Ry * Rx（Three.js 默认 Euler 'XYZ'）
  return {
    r00: cy * cz,
    r01: sx * sy * cz - cx * sz,
    r02: cx * sy * cz + sx * sz,
    r10: cy * sz,
    r11: sx * sy * sz + cx * cz,
    r12: cx * sy * sz - sx * cz,
    r20: -sy,
    r21: sx * cy,
    r22: cx * cy
  }
}

/**
 * OBB → 平面 AABB 投影半径。
 * 2D 绘制、点选、bounds 用；碰撞结论走 nodeOBB。
 */
export function rotatedExtents(
  footprint: FootprintSpec,
  rotation: [number, number, number],
  plane: CollisionPlane
): { eu: number; ev: number } {
  const hw = footprint.width / 2
  const hh = (footprint.height ?? footprint.depth) / 2
  const hd = footprint.depth / 2
  const { r00, r01, r02, r10, r11, r12, r20, r21, r22 } = rotationMatrix(rotation)

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

function footprintHeight(footprint: FootprintSpec): number {
  return footprint.height ?? footprint.depth ?? 1
}

/**
 * 底面 position + 枢轴（footprint 半高）。
 * 有可见网格盒时半尺寸和中心取该盒；否则用 footprint 整盒。缩放绕枢轴。
 */
function nodeOBB(
  transform: TransformJSON,
  item: CatalogItem | undefined,
  mesh?: MeshBounds
): OBB | undefined {
  if (!item) return undefined
  const height = footprintHeight(item.footprint)
  const [sx, sy, sz] = transform.scale
  const pivotY = height / 2
  let half: Vec3
  let local: Vec3
  if (
    mesh &&
    mesh.max[0] > mesh.min[0] &&
    mesh.max[1] > mesh.min[1] &&
    mesh.max[2] > mesh.min[2]
  ) {
    const cx = (mesh.min[0] + mesh.max[0]) / 2
    const cy = (mesh.min[1] + mesh.max[1]) / 2
    const cz = (mesh.min[2] + mesh.max[2]) / 2
    half = [
      ((mesh.max[0] - mesh.min[0]) * Math.abs(sx)) / 2,
      ((mesh.max[1] - mesh.min[1]) * Math.abs(sy)) / 2,
      ((mesh.max[2] - mesh.min[2]) * Math.abs(sz)) / 2
    ]
    local = [cx * sx, (cy - pivotY) * sy, cz * sz]
  } else {
    half = [
      (item.footprint.width * Math.abs(sx)) / 2,
      (height * Math.abs(sy)) / 2,
      (item.footprint.depth * Math.abs(sz)) / 2
    ]
    local = [0, 0, 0]
  }
  const m = rotationMatrix(transform.rotation)
  const [x, y, z] = transform.position
  return {
    center: [
      x + m.r00 * local[0] + m.r01 * local[1] + m.r02 * local[2],
      y + pivotY + m.r10 * local[0] + m.r11 * local[1] + m.r12 * local[2],
      z + m.r20 * local[0] + m.r21 * local[1] + m.r22 * local[2]
    ],
    axes: [
      [m.r00, m.r10, m.r20],
      [m.r01, m.r11, m.r21],
      [m.r02, m.r12, m.r22]
    ],
    half
  }
}

function obbAabb(box: OBB): WorldAabb {
  const e: Vec3 = [0, 0, 0]
  for (let i = 0; i < 3; i++) {
    e[0] += Math.abs(box.axes[i][0]) * box.half[i]
    e[1] += Math.abs(box.axes[i][1]) * box.half[i]
    e[2] += Math.abs(box.axes[i][2]) * box.half[i]
  }
  return {
    min: [box.center[0] - e[0], box.center[1] - e[1], box.center[2] - e[2]],
    max: [box.center[0] + e[0], box.center[1] + e[1], box.center[2] + e[2]]
  }
}

function aabbOverlap3(a: WorldAabb, b: WorldAabb): boolean {
  return (
    a.min[0] < b.max[0] - OVERLAP_TOLERANCE &&
    a.max[0] > b.min[0] + OVERLAP_TOLERANCE &&
    a.min[1] < b.max[1] - OVERLAP_TOLERANCE &&
    a.max[1] > b.min[1] + OVERLAP_TOLERANCE &&
    a.min[2] < b.max[2] - OVERLAP_TOLERANCE &&
    a.max[2] > b.min[2] + OVERLAP_TOLERANCE
  )
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

function support(box: OBB, axis: Vec3): number {
  return (
    box.half[0] * Math.abs(dot(box.axes[0], axis)) +
    box.half[1] * Math.abs(dot(box.axes[1], axis)) +
    box.half[2] * Math.abs(dot(box.axes[2], axis))
  )
}

/** 15 轴分离：有一条轴上的投影分开就不撞。 */
function obbOverlap(a: OBB, b: OBB): boolean {
  const delta: Vec3 = [b.center[0] - a.center[0], b.center[1] - a.center[1], b.center[2] - a.center[2]]
  const axes: Vec3[] = [a.axes[0], a.axes[1], a.axes[2], b.axes[0], b.axes[1], b.axes[2]]
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const c = cross(a.axes[i], b.axes[j])
      const len2 = dot(c, c)
      if (len2 < 1e-10) continue
      const inv = 1 / Math.sqrt(len2)
      axes.push([c[0] * inv, c[1] * inv, c[2] * inv])
    }
  }
  for (const axis of axes) {
    const dist = Math.abs(dot(delta, axis))
    if (dist >= support(a, axis) + support(b, axis) - OVERLAP_TOLERANCE) return false
  }
  return true
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
  resolveMesh?: (nodeId: string) => MeshBounds | undefined
): CollisionHit | undefined {
  const box = nodeOBB(transform, item, excludeId ? resolveMesh?.(excludeId) : undefined)
  if (!box) return undefined
  const loose = obbAabb(box)
  for (const other of siblings) {
    if (other.id === excludeId) continue
    const otherBox = nodeOBB(other.transform, resolveItem(other), resolveMesh?.(other.id))
    if (!otherBox) continue
    if (!aabbOverlap3(loose, obbAabb(otherBox))) continue
    if (obbOverlap(box, otherBox)) {
      return { nodeId: other.id, nodeName: other.name }
    }
  }
  return undefined
}

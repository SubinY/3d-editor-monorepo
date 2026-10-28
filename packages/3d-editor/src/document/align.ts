/** 多选对齐 / 分布。平面与 2D 视口一致：scene 用 XZ，container 用 XY。 */
import type { FootprintSpec } from '../catalog/types'
import { rotatedExtents } from './collision'
import type { TransformJSON } from './types'

export type AlignMode = 'left' | 'right' | 'top' | 'bottom' | 'centerX' | 'centerY'
export type AlignReference = 'bounds' | 'primary'
export type DistributeAxis = 'x' | 'y'
export type AlignPlane = 'xz' | 'xy'

export interface AlignSubject {
  id: string
  transform: TransformJSON
  footprint: FootprintSpec
}

export interface AlignDelta {
  id: string
  du: number
  dv: number
}

interface Box {
  id: string
  minU: number
  maxU: number
  minV: number
  maxV: number
  cu: number
  cv: number
}

const EPS = 1e-6

export function alignPlaneForKind(kind: string): AlignPlane {
  return kind === 'container' ? 'xy' : 'xz'
}

/** 屏幕向上对应的 v 方向：立面 v 向上，俯视 v 向下（与 Camera2D 一致）。 */
function topIsMaxV(plane: AlignPlane): boolean {
  return plane === 'xy'
}

export function footprintAlignBox(
  id: string,
  transform: TransformJSON,
  footprint: FootprintSpec,
  plane: AlignPlane
): Box {
  const { eu, ev } = rotatedExtents(footprint, transform.rotation, plane)
  const u = transform.position[0]
  const v = plane === 'xy' ? transform.position[1] : transform.position[2]
  const cv = plane === 'xy' ? v + (footprint.height ?? footprint.depth) / 2 : v
  return {
    id,
    minU: u - eu,
    maxU: u + eu,
    minV: cv - ev,
    maxV: cv + ev,
    cu: u,
    cv
  }
}

function unionBox(boxes: Box[]): Box {
  let minU = Infinity
  let maxU = -Infinity
  let minV = Infinity
  let maxV = -Infinity
  for (const box of boxes) {
    minU = Math.min(minU, box.minU)
    maxU = Math.max(maxU, box.maxU)
    minV = Math.min(minV, box.minV)
    maxV = Math.max(maxV, box.maxV)
  }
  return { id: '', minU, maxU, minV, maxV, cu: (minU + maxU) / 2, cv: (minV + maxV) / 2 }
}

function deltaFor(box: Box, target: Box, mode: AlignMode, plane: AlignPlane): { du: number; dv: number } {
  const topMax = topIsMaxV(plane)
  switch (mode) {
    case 'left':
      return { du: target.minU - box.minU, dv: 0 }
    case 'right':
      return { du: target.maxU - box.maxU, dv: 0 }
    case 'centerX':
      return { du: target.cu - box.cu, dv: 0 }
    case 'centerY':
      return { du: 0, dv: target.cv - box.cv }
    case 'top':
      return topMax
        ? { du: 0, dv: target.maxV - box.maxV }
        : { du: 0, dv: target.minV - box.minV }
    case 'bottom':
      return topMax
        ? { du: 0, dv: target.minV - box.minV }
        : { du: 0, dv: target.maxV - box.maxV }
    default:
      return { du: 0, dv: 0 }
  }
}

export function planAlign(
  subjects: AlignSubject[],
  mode: AlignMode,
  reference: AlignReference,
  plane: AlignPlane
): AlignDelta[] {
  if (subjects.length < 2) return []
  const boxes = subjects.map(s => footprintAlignBox(s.id, s.transform, s.footprint, plane))
  const primaryId = subjects[0].id
  const target =
    reference === 'primary' ? boxes.find(b => b.id === primaryId) ?? boxes[0] : unionBox(boxes)
  const deltas: AlignDelta[] = []
  for (const box of boxes) {
    if (reference === 'primary' && box.id === primaryId) continue
    const { du, dv } = deltaFor(box, target, mode, plane)
    if (Math.abs(du) < EPS && Math.abs(dv) < EPS) continue
    deltas.push({ id: box.id, du, dv })
  }
  return deltas
}

export function planDistribute(
  subjects: AlignSubject[],
  axis: DistributeAxis,
  plane: AlignPlane
): AlignDelta[] {
  if (subjects.length < 3) return []
  const boxes = subjects.map(s => footprintAlignBox(s.id, s.transform, s.footprint, plane))
  if (axis === 'x') return distributeAlong(boxes, 'u')
  const topMax = topIsMaxV(plane)
  return distributeAlong(boxes, 'v', topMax ? 'desc' : 'asc')
}

function distributeAlong(boxes: Box[], axis: 'u' | 'v', order: 'asc' | 'desc' = 'asc'): AlignDelta[] {
  const minKey = axis === 'u' ? 'minU' : 'minV'
  const maxKey = axis === 'u' ? 'maxU' : 'maxV'
  const sorted = [...boxes].sort((a, b) =>
    order === 'asc' ? a[minKey] - b[minKey] : b[maxKey] - a[maxKey]
  )
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const span =
    axis === 'u' || order === 'asc'
      ? last[maxKey] - first[minKey]
      : first[maxKey] - last[minKey]
  const sizeSum = sorted.reduce((sum, box) => sum + (box[maxKey] - box[minKey]), 0)
  const gap = (span - sizeSum) / (sorted.length - 1)
  const deltas: AlignDelta[] = []
  if (axis === 'u' || order === 'asc') {
    let cursor = first[minKey]
    for (const box of sorted) {
      const size = box[maxKey] - box[minKey]
      const nextMin = cursor
      const delta = nextMin - box[minKey]
      if (Math.abs(delta) >= EPS) {
        deltas.push(axis === 'u' ? { id: box.id, du: delta, dv: 0 } : { id: box.id, du: 0, dv: delta })
      }
      cursor += size + gap
    }
    return deltas
  }
  let cursor = first[maxKey]
  for (const box of sorted) {
    const size = box[maxKey] - box[minKey]
    const nextMin = cursor - size
    const delta = nextMin - box[minKey]
    if (Math.abs(delta) >= EPS) deltas.push({ id: box.id, du: 0, dv: delta })
    cursor -= size + gap
  }
  return deltas
}

export function applyPlaneDelta(
  transform: TransformJSON,
  du: number,
  dv: number,
  plane: AlignPlane
): TransformJSON {
  const position: [number, number, number] = [...transform.position]
  position[0] += du
  if (plane === 'xy') position[1] += dv
  else position[2] += dv
  return {
    position,
    rotation: [...transform.rotation],
    scale: [...transform.scale]
  }
}

/** 2D 框选：平面矩形与节点足迹投影盒相交（压到边也算） */
import type { CatalogItem } from '../../../catalog/types'
import { rotatedExtents } from '../../../document/collision'
import type { EditorNodeJSON } from '../../../document/types'
import type { PlanePoint } from '../types'

export interface PlaneRect {
  minU: number
  maxU: number
  minV: number
  maxV: number
}

export function rectFromPoints(a: PlanePoint, b: PlanePoint): PlaneRect {
  return {
    minU: Math.min(a.u, b.u),
    maxU: Math.max(a.u, b.u),
    minV: Math.min(a.v, b.v),
    maxV: Math.max(a.v, b.v)
  }
}

function rangesOverlap(a0: number, a1: number, b0: number, b1: number): boolean {
  return a0 <= b1 && a1 >= b0
}

/** 文档顺序返回落在框内的可见节点 id */
export function nodesInMarquee(opts: {
  nodes: EditorNodeJSON[]
  rect: PlaneRect
  isElevation: boolean
  planeFromPosition: (pos: [number, number, number]) => PlanePoint
  itemFor: (node: EditorNodeJSON) => CatalogItem | undefined
}): string[] {
  const { nodes, rect, isElevation, planeFromPosition, itemFor } = opts
  const planeKind = isElevation ? 'xy' : 'xz'
  const ids: string[] = []
  for (const node of nodes) {
    if (node.visible === false) continue
    const item = itemFor(node)
    const footprint = item?.footprint ?? { width: 1, depth: 1, height: 1 }
    const { eu, ev } = rotatedExtents(footprint, node.transform.rotation, planeKind)
    const plane = planeFromPosition(node.transform.position)
    const sizeV = isElevation ? footprint.height ?? footprint.depth : footprint.depth
    const cv = isElevation ? plane.v + sizeV / 2 : plane.v
    const minU = plane.u - eu
    const maxU = plane.u + eu
    const minV = cv - ev
    const maxV = cv + ev
    if (
      rangesOverlap(minU, maxU, rect.minU, rect.maxU) &&
      rangesOverlap(minV, maxV, rect.minV, rect.maxV)
    ) {
      ids.push(node.id)
    }
  }
  return ids
}

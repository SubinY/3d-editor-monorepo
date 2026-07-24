/** 节点 / 墙 / 旋转手柄命中检测（纯函数） */
import type { CatalogItem } from '../../../catalog/types'
import type { EditorNodeJSON, WallJSON } from '../../../document/types'
import type { PlanePoint } from '../types'
import type { NodeLayout } from './node-layout'
import { nearestWall } from './wall-snap'

export function hitTestRotateHandle(
  layout: NodeLayout,
  u: number,
  v: number,
  scale: number
): boolean {
  const threshold = Math.max(0.12, 12 / scale)
  return Math.hypot(u - layout.handle.u, v - layout.handle.v) <= threshold
}

export function hitTestNode(opts: {
  nodes: EditorNodeJSON[]
  u: number
  v: number
  isElevation: boolean
  planeFromPosition: (pos: [number, number, number]) => PlanePoint
  footprintSize: (item: CatalogItem | undefined) => { wu: number; wv: number }
  itemFor: (node: EditorNodeJSON) => CatalogItem | undefined
}): EditorNodeJSON | undefined {
  const { nodes, u, v, isElevation, planeFromPosition, footprintSize, itemFor } = opts
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i]
    if (node.visible === false) continue
    const item = itemFor(node)
    const { wu, wv } = footprintSize(item)
    const plane = planeFromPosition(node.transform.position)
    const cu = plane.u
    const cv = isElevation ? plane.v + wv / 2 : plane.v
    const angle = isElevation ? node.transform.rotation[2] : node.transform.rotation[1]
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const du = u - cu
    const dv = v - cv
    const lu = cos * du + sin * dv
    const lv = -sin * du + cos * dv
    if (Math.abs(lu) <= wu / 2 && Math.abs(lv) <= wv / 2) return node
  }
  return undefined
}

export function hitTestWall(
  u: number,
  v: number,
  walls: WallJSON[],
  scale: number,
  isElevation: boolean
): WallJSON | undefined {
  if (isElevation) return undefined
  const near = nearestWall(u, v, walls)
  if (!near) return undefined
  const grab = Math.max((near.wall.thickness ?? 0.2) / 2 + 0.1, 6 / scale)
  return near.dist <= grab ? near.wall : undefined
}

/** 节点 / 墙 / 选中手柄命中检测（纯函数） */
import type { CatalogItem } from '../../../catalog/types'
import { rotatedExtents } from '../../../document/collision'
import type { EditorNodeJSON, WallJSON } from '../../../document/types'
import type { PlanePoint } from '../types'
import { nearestWall } from './wall-snap'

export interface HitTestNodeOpts {
  nodes: EditorNodeJSON[]
  /** 鼠标落点平面坐标（点测，非物体相交） */
  u: number
  v: number
  isElevation: boolean
  planeFromPosition: (pos: [number, number, number]) => PlanePoint
  footprintSize: (item: CatalogItem | undefined) => { wu: number; wv: number }
  itemFor: (node: EditorNodeJSON) => CatalogItem | undefined
}

/**
 * 收集包含鼠标点的全部节点，绘制顺序后置为上（数组尾 → 头）。
 * 命中盒与碰撞/绘制一致：三轴旋转后的轴对齐投影 AABB。
 */
export function hitTestNodes(opts: HitTestNodeOpts): EditorNodeJSON[] {
  const { nodes, u, v, isElevation, planeFromPosition, itemFor } = opts
  const planeKind = isElevation ? 'xy' : 'xz'
  const hits: EditorNodeJSON[] = []
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i]
    if (node.visible === false) continue
    const item = itemFor(node)
    const footprint = item?.footprint ?? { width: 1, depth: 1, height: 1 }
    const { eu, ev } = rotatedExtents(footprint, node.transform.rotation, planeKind)
    const plane = planeFromPosition(node.transform.position)
    const cu = plane.u
    const sizeV = isElevation ? footprint.height ?? footprint.depth : footprint.depth
    const cv = isElevation ? plane.v + sizeV / 2 : plane.v
    if (Math.abs(u - cu) <= eu && Math.abs(v - cv) <= ev) hits.push(node)
  }
  return hits
}

export function hitTestNode(opts: HitTestNodeOpts): EditorNodeJSON | undefined {
  return hitTestNodes(opts)[0]
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

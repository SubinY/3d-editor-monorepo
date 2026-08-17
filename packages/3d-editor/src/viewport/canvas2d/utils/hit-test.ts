/** 节点 / 墙 / 旋转手柄命中检测（纯函数） */
import type { CatalogItem } from '../../../catalog/types'
import type { EditorNodeJSON, WallJSON } from '../../../document/types'
import type { PlanePoint } from '../types'
import type { NodeLayout } from './node-layout'
import { yawToDisplayAngle } from './node-layout'
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
 * 仅当点落在 footprint 内才入选；两物体别处重叠但未点到交叠区不会同时命中。
 */
export function hitTestNodes(opts: HitTestNodeOpts): EditorNodeJSON[] {
  const { nodes, u, v, isElevation, planeFromPosition, footprintSize, itemFor } = opts
  const hits: EditorNodeJSON[] = []
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i]
    if (node.visible === false) continue
    const item = itemFor(node)
    const { wu, wv } = footprintSize(item)
    const plane = planeFromPosition(node.transform.position)
    const cu = plane.u
    const cv = isElevation ? plane.v + wv / 2 : plane.v
    const angle = yawToDisplayAngle(
      isElevation ? node.transform.rotation[2] : node.transform.rotation[1],
      isElevation,
    )
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const du = u - cu
    const dv = v - cv
    /** 与手柄 (sin φ, cos φ) / ctx.rotate(φ) 同构：local+v 朝手柄 */
    const lu = cos * du - sin * dv
    const lv = sin * du + cos * dv
    if (Math.abs(lu) <= wu / 2 && Math.abs(lv) <= wv / 2) hits.push(node)
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

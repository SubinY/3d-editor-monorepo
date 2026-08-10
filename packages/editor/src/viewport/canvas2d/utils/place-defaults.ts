/** 新建落点的面外默认坐标（2D 平面无法表达的轴） */
import type { CatalogItem } from '../../../catalog/types'
import type { BoundsJSON } from '../../../document/types'

/**
 * 与 `viewport/three/helpers/enclosure.ts` 壳体壁厚公式保持一致。
 */
export function enclosureShellThickness(
  width: number,
  height: number,
  depth: number,
): number {
  return Math.min(0.04, Math.min(width, depth, height) * 0.08)
}

/**
 * container：节点原点在 footprint 中心；贴柜内背面。
 * 背面内壁 ≈ -depth/2 + t，故 Z = -depth/2 + t + footprint.depth/2
 */
export function defaultContainerBackZ(
  bounds: BoundsJSON,
  item: CatalogItem,
): number {
  const depth = bounds.depth
  const height = bounds.height ?? 2
  const t = enclosureShellThickness(bounds.width, height, depth)
  const itemDepth = item.footprint.depth > 0 ? item.footprint.depth : 0.1
  return -depth / 2 + t + itemDepth / 2
}

/**
 * scene：节点 Y=0 时 footprint 盒 `mesh.position.y = h/2`，底面贴地。
 */
export function defaultSceneGroundY(_item?: CatalogItem): number {
  return 0
}

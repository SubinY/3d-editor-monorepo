/** 2D service 共享依赖与指针交互约定 */
import type { CatalogItem } from '../../../catalog/types'
import type { EditorDocument } from '../../../document/EditorDocument'
import type { EditorNodeJSON, TransformJSON, WallJSON } from '../../../document/types'
import type { PlanePoint } from '../types'

/** 由 Viewport2D 注入给各 service 的视口能力 */
export interface Viewport2DContext {
  readonly doc: EditorDocument
  readonly readonly: boolean
  readonly isElevation: boolean
  readonly scale: number
  /** 节点拖拽对齐吸附 */
  readonly snapEnabled: boolean
  clientToPlane(clientX: number, clientY: number): PlanePoint
  planeFromPosition(pos: [number, number, number]): PlanePoint
  /**
   * 平面坐标 → 世界坐标。
   * - 有 `base`：保留其面外轴（拖已有节点）
   * - 无 `base` + `item`：container 贴背面 / scene 贴地
   */
  positionFromPlane(
    u: number,
    v: number,
    base?: TransformJSON,
    item?: CatalogItem,
  ): [number, number, number]
  footprintSize(item: CatalogItem | undefined): { wu: number; wv: number }
  itemFor(node: EditorNodeJSON): CatalogItem | undefined
  nodeYaw(node: EditorNodeJSON): number
  yawToRotation(yaw: number, base: TransformJSON['rotation']): [number, number, number]
  requestRender(): void
  onDenied?: (reason: string) => void
  onWallSelect?: (wall: WallJSON) => void
}

export interface PointerInteraction {
  onPointerDown(event: PointerEvent, plane: PlanePoint): boolean
  onPointerMove(event: PointerEvent, plane: PlanePoint): boolean
  onPointerUp(event: PointerEvent): boolean
  reset(): void
}

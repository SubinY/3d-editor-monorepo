/** 2D service 共享的宿主接口与指针交互约定 */
import type { CatalogItem } from '../../../catalog/types'
import type { EditorDocument } from '../../../document/EditorDocument'
import type { EditorNodeJSON, TransformJSON, WallJSON } from '../../../document/types'
import type { PlanePoint } from '../types'

/** 由 Viewport2D 注入给各 service 的宿主能力 */
export interface Viewport2DHost {
  readonly doc: EditorDocument
  readonly readonly: boolean
  readonly isElevation: boolean
  readonly scale: number
  clientToPlane(clientX: number, clientY: number): PlanePoint
  planeFromPosition(pos: [number, number, number]): PlanePoint
  positionFromPlane(u: number, v: number, base?: TransformJSON): [number, number, number]
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

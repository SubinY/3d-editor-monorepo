/** 外部拖放落点：ghost 预览与 placeItem */
import type { CatalogItem } from '../../../catalog/types'
import type { PlaceResult } from '../../../document/EditorDocument'
import { resolveFixturePose } from '../utils/wall-snap'
import type { PlanePoint } from '../types'
import { CATALOG_ITEM_MIME } from '../types'
import type { Viewport2DContext } from './types'

const SOURCE = 'viewport2d'

export interface DropGhost {
  u: number
  v: number
  item: CatalogItem
  yaw: number
  colliding: boolean
}

/** 外部拖放落点（HTML5 DnD + beginExternalDrag） */
export class PlaceService {
  dropGhost: DropGhost | null = null

  constructor(
    private host: Viewport2DContext,
    private onPlaceResult?: (result: PlaceResult) => void
  ) {}

  beginExternalDrag(item: CatalogItem): void {
    this.dropGhost = { u: 0, v: 0, yaw: 0, colliding: false, item }
  }

  endExternalDrag(): void {
    this.dropGhost = null
    this.host.requestRender()
  }

  resolveDropPose(item: CatalogItem, u: number, v: number): { u: number; v: number; yaw: number } {
    return resolveFixturePose(item, u, v, this.host.doc.getWalls(), this.host.isElevation)
  }

  placeItemAt(item: CatalogItem, clientX: number, clientY: number): PlaceResult {
    const plane = this.host.clientToPlane(clientX, clientY)
    const placed = this.resolveDropPose(item, plane.u, plane.v)
    const position = this.host.positionFromPlane(placed.u, placed.v, undefined, item)
    const rotation: [number, number, number] = this.host.isElevation
      ? [0, 0, placed.yaw]
      : [0, placed.yaw, 0]
    const result = this.host.doc.commands.placeItem(item, { position, rotation, source: SOURCE })
    if (result.denied) this.host.onDenied?.(result.denied)
    this.onPlaceResult?.(result)
    this.endExternalDrag()
    return result
  }

  onDragOver(event: DragEvent, clientToPlane: (x: number, y: number) => PlanePoint): void {
    if (this.host.readonly) return
    if (!event.dataTransfer?.types.includes(CATALOG_ITEM_MIME)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    if (!this.dropGhost) return
    const plane = clientToPlane(event.clientX, event.clientY)
    const pose = this.resolveDropPose(this.dropGhost.item, plane.u, plane.v)
    const position = this.host.positionFromPlane(
      pose.u,
      pose.v,
      undefined,
      this.dropGhost.item,
    )
    const rotation: [number, number, number] = this.host.isElevation
      ? [0, 0, pose.yaw]
      : [0, pose.yaw, 0]
    const hit = this.host.doc.checkCollision(
      { position, rotation, scale: [1, 1, 1] },
      this.dropGhost.item
    )
    this.dropGhost = {
      ...this.dropGhost,
      u: pose.u,
      v: pose.v,
      yaw: pose.yaw,
      colliding: Boolean(hit)
    }
    this.host.requestRender()
  }

  onDragLeave(): void {
    if (this.dropGhost) {
      this.dropGhost = { ...this.dropGhost, colliding: false }
    }
    this.host.requestRender()
  }

  onDrop(event: DragEvent): void {
    if (this.host.readonly) return
    const item = this.readDragItem(event) ?? this.dropGhost?.item
    this.dropGhost = null
    if (!item) return
    event.preventDefault()
    this.placeItemAt(item, event.clientX, event.clientY)
  }

  private readDragItem(event: DragEvent): CatalogItem | undefined {
    const raw = event.dataTransfer?.getData(CATALOG_ITEM_MIME)
    if (!raw) return undefined
    try {
      return JSON.parse(raw) as CatalogItem
    } catch {
      return undefined
    }
  }
}

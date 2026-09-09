/** 选择模式：点选、拖移、旋转手柄、墙身/端点拖拽，写回 doc.commands */
import { cloneTransform } from '../../../document/defaults'
import type { EditorNodeJSON, TransformJSON } from '../../../document/types'
import type { AlignGuide } from '../utils/align-guides'
import { snapWithAlignGuides } from '../utils/align-guides'
import {
  computeNodeLayout,
  displayAngleToYaw,
  planeHandleAngle,
  yawToDisplayAngle,
} from '../utils/node-layout'
import { hitTestNodes, hitTestRotateHandle } from '../utils/hit-test'
import type { WallDragMode, WallDragPatch } from '../utils/wall-snap'
import { applyWallDrag, hitWallDragTarget } from '../utils/wall-snap'
import { hitWorkspace } from '../utils/workspace-hit'
import type { PlanePoint } from '../types'
import type { PointerInteraction, Viewport2DContext } from './types'

const SOURCE = 'viewport2d'
const MOVE_THRESHOLD_PX = 5

/** 选择 / 平移 / 旋转手柄 / 墙拖 */
export class SelectInteraction implements PointerInteraction {
  dragNodeId: string | null = null
  dragGhost: PlanePoint | null = null
  dragOffset: PlanePoint = { u: 0, v: 0 }
  dragColliding = false
  dragMoved = false
  alignGuides: AlignGuide[] = []

  rotateNodeId: string | null = null
  rotateCenter: PlanePoint | null = null
  /** 与手柄 φ 同约定：atan2(du, dv)；存的是显示角空间下的起始指针角 */
  rotateStartPointerAngle = 0
  rotateBaseYaw = 0
  rotateGhostYaw = 0
  rotateMoved = false
  rotateColliding = false
  /** pointerdown 时的完整 transform，供松手写一条撤销 */
  rotateBeforeTransform: TransformJSON | null = null

  dragWallId: string | null = null
  wallDragMode: WallDragMode = 'body'
  wallDragOrigin: PlanePoint | null = null
  wallDragPatches: WallDragPatch[] = []
  wallDragMoved = false

  /** 多命中待定：按下未选，松手弹面板或拖移后开始拖 */
  private pendingPickHits: EditorNodeJSON[] | null = null
  private pendingPickDown: { x: number; y: number } | null = null

  constructor(private host: Viewport2DContext) {}

  reset(): void {
    this.dragNodeId = null
    this.dragGhost = null
    this.dragColliding = false
    this.dragMoved = false
    this.alignGuides = []
    this.rotateNodeId = null
    this.rotateCenter = null
    this.rotateMoved = false
    this.rotateColliding = false
    this.rotateBeforeTransform = null
    this.dragWallId = null
    this.wallDragMode = 'body'
    this.wallDragOrigin = null
    this.wallDragPatches = []
    this.wallDragMoved = false
    this.pendingPickHits = null
    this.pendingPickDown = null
  }

  onPointerDown(event: PointerEvent, plane: PlanePoint): boolean {
    if (this.host.readonly || event.button !== 0) return false
    const { doc } = this.host

    const selectedId = doc.selection.first()
    if (selectedId) {
      const selected = doc.getNode(selectedId)
      if (selected && this.hitRotate(selected, plane.u, plane.v)) {
        const layout = this.layoutFor(selected)
        this.rotateNodeId = selected.id
        this.rotateCenter = layout.center
        this.rotateBaseYaw = layout.yaw
        this.rotateGhostYaw = layout.yaw
        this.rotateStartPointerAngle = planeHandleAngle(
          plane.u - layout.center.u,
          plane.v - layout.center.v,
        )
        this.rotateBeforeTransform = cloneTransform(selected.transform)
        this.rotateMoved = false
        this.rotateColliding = false
        this.host.requestRender()
        return true
      }
    }

    const hits = hitTestNodes({
      nodes: doc.getNodes(),
      u: plane.u,
      v: plane.v,
      isElevation: this.host.isElevation,
      planeFromPosition: p => this.host.planeFromPosition(p),
      footprintSize: item => this.host.footprintSize(item),
      itemFor: n => this.host.itemFor(n),
    })

    if (hits.length > 1 && this.host.onPickCandidates) {
      this.pendingPickHits = hits
      this.pendingPickDown = { x: event.clientX, y: event.clientY }
      return true
    }

    if (hits[0]) {
      this.beginNodeDrag(hits[0], plane)
      return true
    }

    const wallHit = hitWallDragTarget(
      doc.getWalls(),
      plane.u,
      plane.v,
      this.host.scale,
      this.host.isElevation
    )
    if (wallHit) {
      const wall = doc.getWall(wallHit.wallId)
      doc.selection.set(wallHit.wallId)
      if (wall) this.host.onWallSelect?.(wall)
      this.dragWallId = wallHit.wallId
      this.wallDragMode = wallHit.mode
      this.wallDragOrigin = { ...plane }
      this.wallDragPatches = []
      this.wallDragMoved = false
      this.host.requestRender()
      return true
    }

    if (!this.host.isElevation) {
      const wsId = hitWorkspace(doc.getWorkspaces(), plane.u, plane.v)
      if (wsId) {
        const ws = doc.getWorkspace(wsId)
        doc.selection.set(wsId)
        if (ws) this.host.onWorkspaceSelect?.(ws)
        this.host.requestRender()
        return true
      }
    }

    doc.selection.clear()
    this.host.requestRender()
    return true
  }

  onPointerMove(event: PointerEvent, plane: PlanePoint): boolean {
    if (this.host.readonly) return false

    if (this.pendingPickHits && this.pendingPickDown) {
      const moved = Math.hypot(
        event.clientX - this.pendingPickDown.x,
        event.clientY - this.pendingPickDown.y
      )
      if (moved > MOVE_THRESHOLD_PX) {
        const selectedId = this.host.doc.selection.first()
        const preferred =
          this.pendingPickHits.find(n => n.id === selectedId) ?? this.pendingPickHits[0]
        this.pendingPickHits = null
        this.pendingPickDown = null
        if (preferred) this.beginNodeDrag(preferred, plane)
      }
      return true
    }

    if (this.rotateNodeId && this.rotateCenter) {
      this.rotateMoved = true
      const du = plane.u - this.rotateCenter.u
      const dv = plane.v - this.rotateCenter.v
      /** 与手柄 / 起始角同一约定 atan2(du,dv)；在显示角空间累加后再映回 document yaw */
      const pointerDisplay = planeHandleAngle(du, dv)
      const deltaDisplay = pointerDisplay - this.rotateStartPointerAngle
      const nextDisplay =
        yawToDisplayAngle(this.rotateBaseYaw, this.host.isElevation) + deltaDisplay
      this.rotateGhostYaw = displayAngleToYaw(nextDisplay, this.host.isElevation)
      const node = this.host.doc.getNode(this.rotateNodeId)
      if (node) {
        const rotation = this.host.yawToRotation(this.rotateGhostYaw, node.transform.rotation)
        const hit = this.host.doc.checkCollision(
          { position: node.transform.position, rotation, scale: node.transform.scale },
          this.host.itemFor(node),
          { excludeId: this.rotateNodeId }
        )
        this.rotateColliding = Boolean(hit)
      }
      this.host.requestRender()
      return true
    }

    if (this.dragWallId && this.wallDragOrigin) {
      this.wallDragMoved = true
      const du = plane.u - this.wallDragOrigin.u
      const dv = plane.v - this.wallDragOrigin.v
      this.wallDragPatches = applyWallDrag(
        this.host.doc.getWalls(),
        this.dragWallId,
        this.wallDragMode,
        du,
        dv
      )
      this.host.requestRender()
      return true
    }

    if (this.dragNodeId) {
      this.dragMoved = true
      let next = { u: plane.u + this.dragOffset.u, v: plane.v + this.dragOffset.v }
      const node = this.host.doc.getNode(this.dragNodeId)
      if (node) {
        const item = this.host.itemFor(node)
        const { wu, wv } = this.host.footprintSize(item)
        const targets = this.host.doc
          .getNodes()
          .filter(n => n.id !== this.dragNodeId)
          .map(n => {
            const fp = this.host.footprintSize(this.host.itemFor(n))
            const p = this.host.planeFromPosition(n.transform.position)
            const cu = p.u
            const cv = this.host.isElevation ? p.v + fp.wv / 2 : p.v
            return { u: cu, v: cv, wu: fp.wu, wv: fp.wv }
          })
        if (this.host.snapEnabled) {
          const centerV = this.host.isElevation ? next.v + wv / 2 : next.v
          const snapped = snapWithAlignGuides({
            moving: { u: next.u, v: centerV, wu, wv },
            targets,
            walls: this.host.isElevation ? [] : this.host.doc.getWalls(),
            threshold: Math.max(0.08, 10 / this.host.scale)
          })
          this.alignGuides = snapped.guides
          next = {
            u: snapped.u,
            v: this.host.isElevation ? snapped.v - wv / 2 : snapped.v
          }
        } else {
          this.alignGuides = []
        }
        this.dragGhost = next
        const nextPos = this.host.positionFromPlane(next.u, next.v, node.transform)
        const hit = this.host.doc.checkCollision(
          { position: nextPos, rotation: node.transform.rotation, scale: node.transform.scale },
          item,
          { excludeId: this.dragNodeId }
        )
        this.dragColliding = Boolean(hit)
      } else {
        this.dragGhost = next
        this.alignGuides = []
      }
      this.host.requestRender()
      return true
    }

    return false
  }

  onPointerUp(_event: PointerEvent): boolean {
    if (this.host.readonly) {
      this.reset()
      return false
    }

    if (this.pendingPickHits && this.pendingPickDown) {
      this.host.onPickCandidates?.({
        nodes: this.pendingPickHits,
        pointer: { x: this.pendingPickDown.x, y: this.pendingPickDown.y },
      })
      this.pendingPickHits = null
      this.pendingPickDown = null
      this.host.requestRender()
      return true
    }

    if (this.rotateNodeId && this.rotateMoved) {
      const node = this.host.doc.getNode(this.rotateNodeId)
      if (node) {
        const result = this.host.doc.commands.transformNode(
          this.rotateNodeId,
          { rotation: this.host.yawToRotation(this.rotateGhostYaw, node.transform.rotation) },
          { source: SOURCE }
        )
        if (!result.ok && result.denied) this.host.onDenied?.(result.denied)
      }
    }

    if (this.dragWallId && this.wallDragMoved && this.wallDragPatches.length) {
      this.host.doc.commands.moveWalls(this.wallDragPatches)
    }

    if (this.dragNodeId && this.dragGhost && this.dragMoved) {
      const node = this.host.doc.getNode(this.dragNodeId)
      if (node) {
        const result = this.host.doc.commands.transformNode(
          this.dragNodeId,
          { position: this.host.positionFromPlane(this.dragGhost.u, this.dragGhost.v, node.transform) },
          { source: SOURCE }
        )
        if (!result.ok && result.denied) this.host.onDenied?.(result.denied)
      }
    }

    this.reset()
    this.host.requestRender()
    return true
  }

  layoutFor(node: EditorNodeJSON) {
    const item = this.host.itemFor(node)
    const { wu, wv } = this.host.footprintSize(item)
    let plane = this.host.planeFromPosition(node.transform.position)
    if (node.id === this.dragNodeId && this.dragGhost) plane = this.dragGhost
    const yaw =
      node.id === this.rotateNodeId && this.rotateMoved ? this.rotateGhostYaw : this.host.nodeYaw(node)
    return computeNodeLayout({
      isElevation: this.host.isElevation,
      plane,
      yaw,
      wu,
      wv
    })
  }

  private beginNodeDrag(node: EditorNodeJSON, plane: PlanePoint): void {
    this.host.doc.selection.set(node.id)
    const nodePlane = this.host.planeFromPosition(node.transform.position)
    this.dragNodeId = node.id
    this.dragOffset = { u: nodePlane.u - plane.u, v: nodePlane.v - plane.v }
    this.dragGhost = { ...nodePlane }
    this.dragColliding = false
    this.dragMoved = false
    this.host.requestRender()
  }

  private hitRotate(node: EditorNodeJSON, u: number, v: number): boolean {
    return hitTestRotateHandle(this.layoutFor(node), u, v, this.host.scale)
  }
}

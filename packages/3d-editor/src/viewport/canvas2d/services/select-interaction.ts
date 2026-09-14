/** 选择模式：点选、拖移、四角手柄（旋转/面外/平面纵向/缩放）、墙身/端点拖拽，写回 doc.commands */
import type { CatalogItem, FootprintSpec } from '../../../catalog/types'
import { rotatedExtents } from '../../../document/collision'
import { cloneTransform } from '../../../document/defaults'
import type { EditorNodeJSON, TransformJSON } from '../../../document/types'
import type { AlignGuide } from '../utils/align-guides'
import { snapWithAlignGuides } from '../utils/align-guides'
import {
  computeNodeLayout,
  displayAngleToYaw,
  planeHandleAngle,
  yawToDisplayAngle,
  type NodeLayout
} from '../utils/node-layout'
import { hitTestNodes } from '../utils/hit-test'
import {
  computeSelectionHandles,
  hitTestSelectionHandle,
  screenUpDeltaV,
  uniformFootprintFromRatio,
  type SelectionHandleKind,
  type SelectionHandles
} from '../utils/selection-handles'
import type { WallDragMode, WallDragPatch } from '../utils/wall-snap'
import { applyWallDrag, hitWallDragTarget } from '../utils/wall-snap'
import { hitWorkspace } from '../utils/workspace-hit'
import type { PlanePoint } from '../types'
import type { PointerInteraction, Viewport2DContext } from './types'

const SOURCE = 'viewport2d'
const MOVE_THRESHOLD_PX = 5
const HANDLE_PAD_PX = 0

export interface NodeSelectLayout extends NodeLayout {
  eu: number
  ev: number
  handles: SelectionHandles
}

/** 选择 / 平移 / 四角手柄 / 墙拖 */
export class SelectInteraction implements PointerInteraction {
  dragNodeId: string | null = null
  dragGhost: PlanePoint | null = null
  dragOffset: PlanePoint = { u: 0, v: 0 }
  dragOrigin: PlanePoint | null = null
  /** 仅改平面 v（屏幕上下） */
  dragAxisLock: 'v' | null = null
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

  /** 面外轴：scene=Y，container=Z */
  liftNodeId: string | null = null
  liftStartOut = 0
  liftStartV = 0
  liftGhostOut = 0
  liftMoved = false

  scaleNodeId: string | null = null
  scaleCenter: PlanePoint | null = null
  scaleStartDist = 0
  scaleStartFp: FootprintSpec | null = null
  scaleGhost: FootprintSpec | null = null
  scaleMoved = false
  scaleColliding = false

  dragWallId: string | null = null
  wallDragMode: WallDragMode = 'body'
  wallDragOrigin: PlanePoint | null = null
  wallDragPatches: WallDragPatch[] = []
  wallDragMoved = false

  /** 多命中待定：按下未选，松手弹面板或拖移后开始拖 */
  private pendingPickHits: EditorNodeJSON[] | null = null
  private pendingPickDown: { x: number; y: number } | null = null

  constructor(private host: Viewport2DContext) {}

  reset(options?: { revertPreview?: boolean }): void {
    const previewId =
      this.dragNodeId ?? this.rotateNodeId ?? this.liftNodeId ?? this.scaleNodeId
    this.dragNodeId = null
    this.dragGhost = null
    this.dragOrigin = null
    this.dragAxisLock = null
    this.dragColliding = false
    this.dragMoved = false
    this.alignGuides = []
    this.rotateNodeId = null
    this.rotateCenter = null
    this.rotateMoved = false
    this.rotateColliding = false
    this.rotateBeforeTransform = null
    this.liftNodeId = null
    this.liftMoved = false
    this.scaleNodeId = null
    this.scaleCenter = null
    this.scaleStartFp = null
    this.scaleGhost = null
    this.scaleMoved = false
    this.scaleColliding = false
    this.dragWallId = null
    this.wallDragMode = 'body'
    this.wallDragOrigin = null
    this.wallDragPatches = []
    this.wallDragMoved = false
    this.pendingPickHits = null
    this.pendingPickDown = null
    if (options?.revertPreview !== false && previewId) {
      this.host.previewNode?.(previewId, null)
    }
  }

  onPointerDown(event: PointerEvent, plane: PlanePoint): boolean {
    if (this.host.readonly || event.button !== 0) return false
    const { doc } = this.host

    const selectedId = doc.selection.first()
    if (selectedId) {
      const selected = doc.getNode(selectedId)
      if (selected) {
        const kind = this.hitHandle(selected, plane.u, plane.v)
        if (kind) {
          this.beginHandle(selected, kind, plane)
          return true
        }
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
      this.push3dPreview()
      this.host.requestRender()
      return true
    }

    if (this.liftNodeId) {
      this.liftMoved = true
      const dv = plane.v - this.liftStartV
      this.liftGhostOut = this.liftStartOut + screenUpDeltaV(this.host.isElevation, dv)
      this.push3dPreview()
      this.host.requestRender()
      return true
    }

    if (this.scaleNodeId && this.scaleCenter && this.scaleStartFp) {
      this.scaleMoved = true
      const dist = Math.hypot(plane.u - this.scaleCenter.u, plane.v - this.scaleCenter.v)
      const ratio = dist / this.scaleStartDist
      this.scaleGhost = uniformFootprintFromRatio(this.scaleStartFp, ratio)
      const node = this.host.doc.getNode(this.scaleNodeId)
      if (node) {
        const item = this.ghostItem(node, this.scaleGhost)
        const hit = this.host.doc.checkCollision(node.transform, item, {
          excludeId: this.scaleNodeId
        })
        this.scaleColliding = Boolean(hit)
      }
      this.push3dPreview()
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
      if (this.dragAxisLock === 'v' && this.dragOrigin) next.u = this.dragOrigin.u
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
          if (this.dragAxisLock === 'v' && this.dragOrigin) next.u = this.dragOrigin.u
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
      this.push3dPreview()
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

    let revertPreview = true

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

    if (this.liftNodeId && this.liftMoved) {
      const node = this.host.doc.getNode(this.liftNodeId)
      if (node) {
        const position: [number, number, number] = [...node.transform.position]
        if (this.host.isElevation) position[2] = this.liftGhostOut
        else position[1] = this.liftGhostOut
        const result = this.host.doc.commands.transformNode(
          this.liftNodeId,
          { position },
          { source: SOURCE }
        )
        if (!result.ok && result.denied) this.host.onDenied?.(result.denied)
      }
    }

    if (this.scaleNodeId && this.scaleMoved && this.scaleGhost) {
      const result = this.host.doc.commands.resizeNode(
        this.scaleNodeId,
        this.scaleGhost,
        { source: SOURCE }
      )
      if (result.ok) revertPreview = false
      else if (result.denied) this.host.onDenied?.(result.denied)
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

    this.reset({ revertPreview })
    this.host.requestRender()
    return true
  }

  layoutFor(node: EditorNodeJSON): NodeSelectLayout {
    const fp = this.footprintFor(node)
    const wu = fp.width
    const wv = this.host.isElevation ? (fp.height ?? fp.depth) : fp.depth
    let plane = this.host.planeFromPosition(node.transform.position)
    if (node.id === this.dragNodeId && this.dragGhost) plane = this.dragGhost
    const yaw =
      node.id === this.rotateNodeId && this.rotateMoved ? this.rotateGhostYaw : this.host.nodeYaw(node)
    const rotation = this.host.yawToRotation(yaw, node.transform.rotation)
    const planeKind = this.host.isElevation ? 'xy' : 'xz'
    const { eu, ev } = rotatedExtents(fp, rotation, planeKind)
    const base = computeNodeLayout({
      isElevation: this.host.isElevation,
      plane,
      yaw,
      wu,
      wv
    })
    const handles = computeSelectionHandles({
      isElevation: this.host.isElevation,
      center: base.center,
      eu,
      ev,
      pad: HANDLE_PAD_PX / this.host.scale
    })
    return { ...base, eu, ev, handles }
  }

  private push3dPreview(): void {
    const preview = this.host.previewNode
    if (!preview) return

    if (this.rotateNodeId && this.rotateMoved) {
      const node = this.host.doc.getNode(this.rotateNodeId)
      if (!node) return
      preview(this.rotateNodeId, {
        rotation: this.host.yawToRotation(this.rotateGhostYaw, node.transform.rotation)
      })
      return
    }

    if (this.liftNodeId && this.liftMoved) {
      const node = this.host.doc.getNode(this.liftNodeId)
      if (!node) return
      const position: [number, number, number] = [...node.transform.position]
      if (this.host.isElevation) position[2] = this.liftGhostOut
      else position[1] = this.liftGhostOut
      preview(this.liftNodeId, { position })
      return
    }

    if (this.scaleNodeId && this.scaleMoved && this.scaleGhost && this.scaleStartFp) {
      const baseW = Math.max(this.scaleStartFp.width, 1e-6)
      preview(this.scaleNodeId, { uniformScale: this.scaleGhost.width / baseW })
      return
    }

    if (this.dragNodeId && this.dragGhost && this.dragMoved) {
      const node = this.host.doc.getNode(this.dragNodeId)
      if (!node) return
      preview(this.dragNodeId, {
        position: this.host.positionFromPlane(
          this.dragGhost.u,
          this.dragGhost.v,
          node.transform
        )
      })
    }
  }

  private footprintFor(node: EditorNodeJSON): FootprintSpec {
    if (node.id === this.scaleNodeId && this.scaleGhost) return this.scaleGhost
    return this.host.itemFor(node)?.footprint ?? { width: 1, depth: 1, height: 1 }
  }

  private ghostItem(node: EditorNodeJSON, footprint: FootprintSpec): CatalogItem {
    const item = this.host.itemFor(node)
    if (item) return { ...item, footprint }
    return {
      id: node.catalogRef?.id ?? node.id,
      version: node.catalogRef?.version ?? '0',
      name: node.name ?? node.id,
      placeableIn: [this.host.isElevation ? 'container' : 'scene'],
      footprint
    }
  }

  private beginHandle(node: EditorNodeJSON, kind: SelectionHandleKind, plane: PlanePoint): void {
    if (kind === 'rotate') {
      const layout = this.layoutFor(node)
      this.rotateNodeId = node.id
      this.rotateCenter = layout.center
      this.rotateBaseYaw = layout.yaw
      this.rotateGhostYaw = layout.yaw
      this.rotateStartPointerAngle = planeHandleAngle(
        plane.u - layout.center.u,
        plane.v - layout.center.v,
      )
      this.rotateBeforeTransform = cloneTransform(node.transform)
      this.rotateMoved = false
      this.rotateColliding = false
      this.host.requestRender()
      return
    }
    if (kind === 'lift') {
      this.liftNodeId = node.id
      this.liftStartOut = this.host.isElevation
        ? node.transform.position[2]
        : node.transform.position[1]
      this.liftStartV = plane.v
      this.liftGhostOut = this.liftStartOut
      this.liftMoved = false
      this.host.requestRender()
      return
    }
    if (kind === 'slideV') {
      this.beginNodeDrag(node, plane, 'v')
      return
    }
    const layout = this.layoutFor(node)
    const fp = this.footprintFor(node)
    this.scaleNodeId = node.id
    this.scaleCenter = layout.center
    this.scaleStartDist = Math.hypot(plane.u - layout.center.u, plane.v - layout.center.v)
    if (this.scaleStartDist < 1e-4) {
      this.scaleStartDist = Math.max(layout.eu, layout.ev, 0.05)
    }
    this.scaleStartFp = {
      width: fp.width,
      depth: fp.depth,
      height: fp.height ?? fp.depth
    }
    this.scaleGhost = { ...this.scaleStartFp }
    this.scaleMoved = false
    this.scaleColliding = false
    this.host.requestRender()
  }

  private beginNodeDrag(
    node: EditorNodeJSON,
    plane: PlanePoint,
    axisLock: 'v' | null = null
  ): void {
    this.host.doc.selection.set(node.id)
    const nodePlane = this.host.planeFromPosition(node.transform.position)
    this.dragNodeId = node.id
    this.dragOrigin = { ...nodePlane }
    this.dragAxisLock = axisLock
    this.dragOffset = { u: nodePlane.u - plane.u, v: nodePlane.v - plane.v }
    this.dragGhost = { ...nodePlane }
    this.dragColliding = false
    this.dragMoved = false
    this.host.requestRender()
  }

  private hitHandle(node: EditorNodeJSON, u: number, v: number): SelectionHandleKind | null {
    return hitTestSelectionHandle(this.layoutFor(node).handles, u, v, this.host.scale)
  }
}

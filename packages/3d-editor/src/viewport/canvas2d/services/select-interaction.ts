/** 选择模式：点选、拖移、四角手柄（旋转/面外/平面纵向/缩放）、墙身/端点拖拽、工作区顶点拖拽，写回 doc.commands */
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
import { nodesInMarquee, rectFromPoints } from '../utils/marquee'
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
import { hitWorkspace, hitWorkspaceVertex, hitWorkspaceEdge, insertOutlineVertex } from '../utils/workspace-hit'
import type { PlanePoint } from '../types'
import type { PointerInteraction, Viewport2DContext } from './types'

const SOURCE = 'viewport2d'
const MOVE_THRESHOLD_PX = 5
/** 四角手柄相对 AABB 外扩（屏幕像素），避免贴住虚线框角 */
const HANDLE_PAD_PX = 6

export interface NodeSelectLayout extends NodeLayout {
  eu: number
  ev: number
  handles: SelectionHandles
}

/** 选择 / 平移 / 四角手柄 / 墙拖 */
export class SelectInteraction implements PointerInteraction {
  dragNodeId: string | null = null
  /** 多选拖动时的节点集合（含锚点）。空表示单节点拖。 */
  dragCohort: string[] = []
  private cohortStarts = new Map<string, PlanePoint>()
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

  /** 工作区顶点拖拽（预览 outline，松手写 setWorkspaceOutline） */
  dragWorkspaceId: string | null = null
  dragWorkspaceVertexIndex = -1
  workspaceVertexOrigin: PlanePoint | null = null
  workspaceOutlineBase: [number, number][] | null = null
  workspaceOutlineGhost: [number, number][] | null = null
  workspaceVertexMoved = false

  /**
   * 「边加点」模式目标工作区 id；非 null 时吞掉指针，可连续点边插入。
   * 退出：Esc / 取消按钮；切工具或取消选中也会退出。不放进 reset()，避免拖拽松手误清。
   */
  insertVertexWorkspaceId: string | null = null

  /** 多命中待定：按下未选，松手弹面板或拖移后开始拖 */
  private pendingPickHits: EditorNodeJSON[] | null = null
  private pendingPickDown: { x: number; y: number } | null = null

  /** 已越过阈值的框选矩形（平面坐标） */
  marquee: { a: PlanePoint; b: PlanePoint } | null = null
  private marqueeDown: {
    x: number
    y: number
    plane: PlanePoint
    additive: boolean
    workspaceId: string | null
  } | null = null

  constructor(private host: Viewport2DContext) {}

  beginInsertVertex(workspaceId: string): void {
    this.insertVertexWorkspaceId = workspaceId
    this.host.onInsertWorkspaceVertexModeChange?.(true)
    this.host.requestRender()
  }

  endInsertVertex(): void {
    if (!this.insertVertexWorkspaceId) return
    this.insertVertexWorkspaceId = null
    this.host.onInsertWorkspaceVertexModeChange?.(false)
    this.host.requestRender()
  }

  isInsertVertexMode(): boolean {
    return this.insertVertexWorkspaceId != null
  }

  reset(options?: { revertPreview?: boolean }): void {
    const previewIds = [
      this.dragNodeId,
      ...this.dragCohort,
      this.rotateNodeId,
      this.liftNodeId,
      this.scaleNodeId
    ].filter((id): id is string => Boolean(id))
    this.dragNodeId = null
    this.dragCohort = []
    this.cohortStarts.clear()
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
    this.dragWorkspaceId = null
    this.dragWorkspaceVertexIndex = -1
    this.workspaceVertexOrigin = null
    this.workspaceOutlineBase = null
    this.workspaceOutlineGhost = null
    this.workspaceVertexMoved = false
    this.pendingPickHits = null
    this.pendingPickDown = null
    this.marquee = null
    this.marqueeDown = null
    if (options?.revertPreview !== false) {
      const seen = new Set<string>()
      for (const id of previewIds) {
        if (seen.has(id)) continue
        seen.add(id)
        this.host.previewNode?.(id, null)
      }
    }
  }

  onPointerDown(event: PointerEvent, plane: PlanePoint): boolean {
    if (this.host.readonly) return false

    if (this.insertVertexWorkspaceId) {
      if (event.button === 2) return true
      if (event.button !== 0) return false
      const ws = this.host.doc.getWorkspace(this.insertVertexWorkspaceId)
      if (!ws || this.host.isElevation) {
        this.endInsertVertex()
        return true
      }
      const edgeHit = hitWorkspaceEdge(ws.outline, plane.u, plane.v, this.host.scale)
      if (edgeHit) {
        const next = insertOutlineVertex(ws.outline, edgeHit.edgeIndex, edgeHit.t)
        this.host.doc.commands.setWorkspaceOutline(ws.id, next)
        this.host.requestRender()
        return true
      }
      this.host.requestRender()
      return true
    }

    if (event.button !== 0) return false
    const { doc } = this.host

    const selectedNodes = this.selectedNodeIds()
    if (selectedNodes.length === 1) {
      const selected = doc.getNode(selectedNodes[0])
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
      if (event.ctrlKey || event.metaKey) {
        doc.selection.toggle(hits[0].id)
        this.host.requestRender()
        return true
      }
      const nodeIds = this.selectedNodeIds()
      if (nodeIds.length > 1 && nodeIds.includes(hits[0].id)) {
        this.beginCohortDrag(nodeIds, hits[0], plane)
        return true
      }
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
      const vertexHit = hitWorkspaceVertex(
        doc.getWorkspaces(),
        plane.u,
        plane.v,
        this.host.scale
      )
      if (vertexHit) {
        const ws = doc.getWorkspace(vertexHit.workspaceId)
        doc.selection.set(vertexHit.workspaceId)
        if (ws) this.host.onWorkspaceSelect?.(ws)
        this.dragWorkspaceId = vertexHit.workspaceId
        this.dragWorkspaceVertexIndex = vertexHit.vertexIndex
        this.workspaceVertexOrigin = { ...plane }
        this.workspaceOutlineBase = ws
          ? ws.outline.map(p => [...p] as [number, number])
          : null
        this.workspaceOutlineGhost = this.workspaceOutlineBase
          ? this.workspaceOutlineBase.map(p => [...p] as [number, number])
          : null
        this.workspaceVertexMoved = false
        this.host.requestRender()
        return true
      }

    }

    const workspaceId = this.host.isElevation
      ? null
      : hitWorkspace(doc.getWorkspaces(), plane.u, plane.v) ?? null
    this.marqueeDown = {
      x: event.clientX,
      y: event.clientY,
      plane: { ...plane },
      additive: event.ctrlKey || event.metaKey,
      workspaceId
    }
    this.marquee = null
    this.host.requestRender()
    return true
  }

  onPointerMove(event: PointerEvent, plane: PlanePoint): boolean {
    if (this.host.readonly) return false

    if (this.marqueeDown) {
      const moved = Math.hypot(event.clientX - this.marqueeDown.x, event.clientY - this.marqueeDown.y)
      if (moved > MOVE_THRESHOLD_PX) {
        this.marquee = { a: this.marqueeDown.plane, b: { ...plane } }
        this.host.requestRender()
      }
      return true
    }

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

    if (
      this.dragWorkspaceId &&
      this.workspaceVertexOrigin &&
      this.workspaceOutlineBase &&
      this.dragWorkspaceVertexIndex >= 0
    ) {
      this.workspaceVertexMoved = true
      const du = plane.u - this.workspaceVertexOrigin.u
      const dv = plane.v - this.workspaceVertexOrigin.v
      const base = this.workspaceOutlineBase[this.dragWorkspaceVertexIndex]
      const next = this.workspaceOutlineBase.map(p => [...p] as [number, number])
      next[this.dragWorkspaceVertexIndex] = [base[0] + du, base[1] + dv]
      this.workspaceOutlineGhost = next
      this.host.requestRender()
      return true
    }

    if (this.dragNodeId && this.dragCohort.length > 1 && this.dragOrigin) {
      this.dragMoved = true
      let next = { u: plane.u + this.dragOffset.u, v: plane.v + this.dragOffset.v }
      let du = next.u - this.dragOrigin.u
      let dv = next.v - this.dragOrigin.v
      if (this.host.snapEnabled) {
        const snapped = this.snapCohort(this.dragCohort, du, dv)
        du = snapped.du
        dv = snapped.dv
        this.alignGuides = snapped.guides
        next = { u: this.dragOrigin.u + du, v: this.dragOrigin.v + dv }
      } else {
        this.alignGuides = []
      }
      this.dragGhost = next
      this.dragColliding = this.cohortCollides(this.dragCohort)
      this.push3dPreview()
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

    if (this.marqueeDown) {
      const down = this.marqueeDown
      const rect = this.marquee
      this.marqueeDown = null
      this.marquee = null
      if (rect) {
        this.applyMarquee(rect.a, rect.b, down.additive)
      } else if (down.workspaceId) {
        const ws = this.host.doc.getWorkspace(down.workspaceId)
        this.host.doc.selection.set(down.workspaceId)
        if (ws) this.host.onWorkspaceSelect?.(ws)
      } else {
        this.host.doc.selection.clear()
      }
      this.host.requestRender()
      return true
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

    if (
      this.dragWorkspaceId &&
      this.workspaceVertexMoved &&
      this.workspaceOutlineGhost &&
      this.workspaceOutlineGhost.length >= 3
    ) {
      this.host.doc.commands.setWorkspaceOutline(
        this.dragWorkspaceId,
        this.workspaceOutlineGhost
      )
    }

    if (this.dragNodeId && this.dragGhost && this.dragMoved) {
      if (this.dragCohort.length > 1) {
        const updates = this.dragCohort.flatMap(id => {
          const node = this.host.doc.getNode(id)
          const at = this.previewPlane(id)
          if (!node || !at) return []
          return [
            {
              id,
              next: {
                position: this.host.positionFromPlane(at.u, at.v, node.transform)
              }
            }
          ]
        })
        const result = this.host.doc.commands.transformNodes(updates, { source: SOURCE, rigid: true })
        if (!result.ok && result.denied) this.host.onDenied?.(result.denied)
      } else {
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
    const preview = this.previewPlane(node.id)
    if (preview) plane = preview
    else if (node.id === this.dragNodeId && this.dragGhost) plane = this.dragGhost
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
      const ids = this.dragCohort.length > 1 ? this.dragCohort : [this.dragNodeId]
      for (const id of ids) {
        const node = this.host.doc.getNode(id)
        const at = ids.length > 1 ? this.previewPlane(id) : this.dragGhost
        if (!node || !at) continue
        preview(id, {
          position: this.host.positionFromPlane(at.u, at.v, node.transform)
        })
      }
    }
  }

  /** 拖动预览平面坐标。未发生位移时返回 null。 */
  previewPlane(nodeId: string): PlanePoint | null {
    if (!this.dragMoved || !this.dragGhost || !this.dragOrigin || !this.dragNodeId) return null
    if (nodeId === this.dragNodeId && this.dragCohort.length <= 1) return { ...this.dragGhost }
    const start =
      nodeId === this.dragNodeId
        ? this.dragOrigin
        : this.cohortStarts.get(nodeId)
    if (!start || (nodeId !== this.dragNodeId && !this.cohortStarts.has(nodeId))) return null
    const du = this.dragGhost.u - this.dragOrigin.u
    const dv = this.dragGhost.v - this.dragOrigin.v
    return { u: start.u + du, v: start.v + dv }
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
    if (!this.host.canResizeNode(node)) return
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

  private applyMarquee(a: PlanePoint, b: PlanePoint, additive: boolean): void {
    const ids = nodesInMarquee({
      nodes: this.host.doc.getNodes(),
      rect: rectFromPoints(a, b),
      isElevation: this.host.isElevation,
      planeFromPosition: pos => this.host.planeFromPosition(pos),
      itemFor: node => this.host.itemFor(node)
    })
    if (!additive) {
      this.host.doc.selection.set(ids)
      return
    }
    const next = this.host.doc.selection.get()
    for (const id of ids) {
      if (!next.includes(id)) next.push(id)
    }
    this.host.doc.selection.set(next)
  }

  private selectedNodeIds(): string[] {
    return this.host.doc.selection.get().filter(id => this.host.doc.getNode(id))
  }

  private beginCohortDrag(ids: string[], anchor: EditorNodeJSON, plane: PlanePoint): void {
    this.dragCohort = [...ids]
    this.cohortStarts.clear()
    for (const id of ids) {
      const node = this.host.doc.getNode(id)
      if (!node) continue
      this.cohortStarts.set(id, { ...this.host.planeFromPosition(node.transform.position) })
    }
    const nodePlane = this.cohortStarts.get(anchor.id) ?? this.host.planeFromPosition(anchor.transform.position)
    this.dragNodeId = anchor.id
    this.dragOrigin = { ...nodePlane }
    this.dragAxisLock = null
    this.dragOffset = { u: nodePlane.u - plane.u, v: nodePlane.v - plane.v }
    this.dragGhost = { ...nodePlane }
    this.dragColliding = false
    this.dragMoved = false
    this.alignGuides = []
    this.host.requestRender()
  }

  private snapCohort(
    ids: string[],
    du: number,
    dv: number
  ): { du: number; dv: number; guides: AlignGuide[] } {
    let minU = Infinity
    let maxU = -Infinity
    let minV = Infinity
    let maxV = -Infinity
    for (const id of ids) {
      const node = this.host.doc.getNode(id)
      const start = node ? this.cohortStarts.get(id) : undefined
      if (!node || !start) continue
      const fp = this.host.footprintSize(this.host.itemFor(node))
      const u = start.u + du
      const v = start.v + dv
      const cv = this.host.isElevation ? v + fp.wv / 2 : v
      minU = Math.min(minU, u - fp.wu / 2)
      maxU = Math.max(maxU, u + fp.wu / 2)
      minV = Math.min(minV, cv - fp.wv / 2)
      maxV = Math.max(maxV, cv + fp.wv / 2)
    }
    const moving = {
      u: (minU + maxU) / 2,
      v: (minV + maxV) / 2,
      wu: maxU - minU,
      wv: maxV - minV
    }
    const skip = new Set(ids)
    const targets = this.host.doc
      .getNodes()
      .filter(n => !skip.has(n.id))
      .map(n => {
        const fp = this.host.footprintSize(this.host.itemFor(n))
        const p = this.host.planeFromPosition(n.transform.position)
        return {
          u: p.u,
          v: this.host.isElevation ? p.v + fp.wv / 2 : p.v,
          wu: fp.wu,
          wv: fp.wv
        }
      })
    const snapped = snapWithAlignGuides({
      moving,
      targets,
      walls: this.host.isElevation ? [] : this.host.doc.getWalls(),
      threshold: Math.max(0.08, 10 / this.host.scale)
    })
    return {
      du: du + (snapped.u - moving.u),
      dv: dv + (snapped.v - moving.v),
      guides: snapped.guides
    }
  }

  private cohortCollides(ids: string[]): boolean {
    const proposed = ids.flatMap(id => {
      const node = this.host.doc.getNode(id)
      const at = this.previewPlane(id)
      if (!node || !at) return []
      return [
        {
          id,
          transform: {
            position: this.host.positionFromPlane(at.u, at.v, node.transform),
            rotation: [...node.transform.rotation] as [number, number, number],
            scale: [...node.transform.scale] as [number, number, number]
          }
        }
      ]
    })
    return Boolean(this.host.doc.checkProposedTransforms(proposed, { rigid: true }))
  }

  private beginNodeDrag(
    node: EditorNodeJSON,
    plane: PlanePoint,
    axisLock: 'v' | null = null
  ): void {
    this.dragCohort = []
    this.cohortStarts.clear()
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
    const kind = hitTestSelectionHandle(this.layoutFor(node).handles, u, v, this.host.scale)
    if (kind === 'scale' && !this.host.canResizeNode(node)) return null
    return kind
  }
}

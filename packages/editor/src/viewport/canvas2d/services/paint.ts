/** 2D Canvas 整帧绘制：地板、网格、墙、节点、ghost、旋转手柄、对齐线 */
import type { CatalogItem } from '../../../catalog/types'
import type { EditorDocument } from '../../../document/EditorDocument'
import type { EditorNodeJSON, WallJSON } from '../../../document/types'
import type { PlanePoint, Theme2D, Tool2D } from '../types'
import { findClosedWallLoops } from '../utils/closed-loops'
import type { Camera2D } from './camera'
import type { DropGhost } from './place'
import type { SelectInteraction } from './select-interaction'
import type { WallInteraction } from './wall-interaction'

export interface Paint2DContext {
  ctx: CanvasRenderingContext2D
  camera: Camera2D
  doc: EditorDocument
  theme: Theme2D
  tool: Tool2D
  readonly: boolean
  isElevation: boolean
  select: SelectInteraction
  wall: WallInteraction
  dropGhost: DropGhost | null
  footprintSize: (item: CatalogItem | undefined) => { wu: number; wv: number }
  itemFor: (node: EditorNodeJSON) => CatalogItem | undefined
  planeFromPosition: (pos: [number, number, number]) => PlanePoint
}

export function paintScene(p: Paint2DContext, width: number, height: number): void {
  const { ctx, theme } = p
  ctx.fillStyle = theme.background
  ctx.fillRect(0, 0, width, height)
  drawGrid(p, width, height)
  drawBounds(p)
  if (!p.isElevation) {
    drawFloors(p)
    drawWalls(p)
  }
  drawNodes(p)
  drawChainGhost(p)
  drawDropGhost(p)
  drawAlignGuides(p)
}

function drawGrid(p: Paint2DContext, width: number, height: number): void {
  const { ctx, camera, theme } = p
  const step = camera.scale
  if (step < 8) return
  const startX = ((camera.offsetX % step) + step) % step
  const startY = ((camera.offsetY % step) + step) % step
  ctx.strokeStyle = theme.grid
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let x = startX; x < width; x += step) {
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
  }
  for (let y = startY; y < height; y += step) {
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
  }
  ctx.stroke()

  const major = step * 5
  const majorStartX = ((camera.offsetX % major) + major) % major
  const majorStartY = ((camera.offsetY % major) + major) % major
  ctx.strokeStyle = theme.gridMajor
  ctx.beginPath()
  for (let x = majorStartX; x < width; x += major) {
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
  }
  for (let y = majorStartY; y < height; y += major) {
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
  }
  ctx.stroke()
}

function drawBounds(p: Paint2DContext): void {
  const { ctx, camera, doc, theme, isElevation } = p
  const w = doc.bounds.width
  if (isElevation) {
    const h = doc.bounds.height ?? 2
    const bl = camera.worldToScreen(-w / 2, 0)
    const tr = camera.worldToScreen(w / 2, h)
    ctx.strokeStyle = theme.bounds
    ctx.lineWidth = 2
    ctx.strokeRect(bl.sx, tr.sy, tr.sx - bl.sx, bl.sy - tr.sy)
    if (camera.scale > 8) {
      ctx.fillStyle = theme.dimension
      ctx.font = '11px sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(`${w.toFixed(1)}m × ${h.toFixed(1)}m（宽×高）`, bl.sx + 4, tr.sy - 6)
    }
    return
  }

  const d = doc.bounds.depth
  const tl = camera.worldToScreen(-w / 2, -d / 2)
  const br = camera.worldToScreen(w / 2, d / 2)
  ctx.strokeStyle = theme.bounds
  ctx.lineWidth = 1.2
  ctx.setLineDash([6, 5])
  ctx.globalAlpha = 0.45
  ctx.strokeRect(tl.sx, tl.sy, br.sx - tl.sx, br.sy - tl.sy)
  ctx.globalAlpha = 1
  ctx.setLineDash([])
  if (camera.scale > 8) {
    ctx.fillStyle = theme.dimension
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(`${w.toFixed(1)}m × ${d.toFixed(1)}m`, tl.sx + 4, tl.sy - 6)
  }
}

function drawFloors(p: Paint2DContext): void {
  const loops = findClosedWallLoops(p.doc.getWalls())
  if (!loops.length) return
  const { ctx, camera, theme } = p
  ctx.fillStyle = theme.floor
  ctx.globalAlpha = 0.55
  loops.forEach(loop => {
    if (loop.points.length < 3) return
    ctx.beginPath()
    const first = camera.worldToScreen(loop.points[0].u, loop.points[0].v)
    ctx.moveTo(first.sx, first.sy)
    for (let i = 1; i < loop.points.length; i++) {
      const pt = camera.worldToScreen(loop.points[i].u, loop.points[i].v)
      ctx.lineTo(pt.sx, pt.sy)
    }
    ctx.closePath()
    ctx.fill()
  })
  ctx.globalAlpha = 1
}

function drawAlignGuides(p: Paint2DContext): void {
  const guides = p.select.alignGuides
  if (!guides.length) return
  const { ctx, camera, theme } = p
  ctx.save()
  ctx.strokeStyle = theme.guide
  ctx.lineWidth = 1
  ctx.setLineDash([4, 4])
  ctx.globalAlpha = 0.9
  guides.forEach(g => {
    ctx.beginPath()
    if (g.axis === 'u') {
      const a = camera.worldToScreen(g.value, g.spanFrom)
      const b = camera.worldToScreen(g.value, g.spanTo)
      ctx.moveTo(a.sx, a.sy)
      ctx.lineTo(b.sx, b.sy)
    } else {
      const a = camera.worldToScreen(g.spanFrom, g.value)
      const b = camera.worldToScreen(g.spanTo, g.value)
      ctx.moveTo(a.sx, a.sy)
      ctx.lineTo(b.sx, b.sy)
    }
    ctx.stroke()
  })
  ctx.restore()
}

function drawWalls(p: Paint2DContext): void {
  const { ctx, camera, doc, theme, select, tool, readonly } = p
  const selection = doc.selection.get()
  const patchMap = new Map(select.wallDragPatches.map(patch => [patch.id, patch]))
  ctx.lineCap = 'round'
  doc.getWalls().forEach(wall => {
    const patch = patchMap.get(wall.id)
    const wa = patch?.a ?? wall.a
    const wb = patch?.b ?? wall.b
    const a = camera.worldToScreen(wa[0], wa[1])
    const b = camera.worldToScreen(wb[0], wb[1])
    const selected = selection.includes(wall.id)
    ctx.strokeStyle = selected ? theme.wallSelected : theme.wall
    ctx.lineWidth = Math.max(3, (wall.thickness ?? 0.2) * camera.scale)
    ctx.beginPath()
    ctx.moveTo(a.sx, a.sy)
    ctx.lineTo(b.sx, b.sy)
    ctx.stroke()
    drawWallDimension(p, { ...wall, a: wa, b: wb })

    if (selected && tool === 'select' && !readonly) {
      drawWallEndpointHandles(p, wa, wb)
    }
  })
}

function drawWallEndpointHandles(
  p: Paint2DContext,
  a: [number, number],
  b: [number, number]
): void {
  const { ctx, camera, theme } = p
  ;[a, b].forEach(pt => {
    const s = camera.worldToScreen(pt[0], pt[1])
    ctx.fillStyle = theme.wallSelected
    ctx.beginPath()
    ctx.arc(s.sx, s.sy, 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'
    ctx.lineWidth = 1.5
    ctx.stroke()
  })
}

function drawWallDimension(p: Paint2DContext, wall: WallJSON): void {
  if (p.camera.scale < 10) return
  const length = Math.hypot(wall.b[0] - wall.a[0], wall.b[1] - wall.a[1])
  if (length < 0.5) return
  const { ctx, camera, theme } = p
  const mid = camera.worldToScreen((wall.a[0] + wall.b[0]) / 2, (wall.a[1] + wall.b[1]) / 2)
  const angle = Math.atan2(wall.b[1] - wall.a[1], wall.b[0] - wall.a[0])
  const offset = Math.max(10, ((wall.thickness ?? 0.2) * camera.scale) / 2 + 10)
  const nx = Math.sin(angle)
  const ny = -Math.cos(angle)
  ctx.save()
  ctx.translate(mid.sx + nx * offset, mid.sy + ny * offset)
  let textAngle = angle
  if (textAngle > Math.PI / 2 || textAngle < -Math.PI / 2) textAngle += Math.PI
  ctx.rotate(textAngle)
  ctx.fillStyle = theme.dimension
  ctx.font = '11px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(`${length.toFixed(1)}m`, 0, 0)
  ctx.restore()
}

function drawChainGhost(p: Paint2DContext): void {
  const { chainLast, chainCursor } = p.wall
  if (!chainLast) return
  const { ctx, camera, theme } = p
  const a = camera.worldToScreen(chainLast.u, chainLast.v)
  ctx.fillStyle = theme.nodeSelected
  ctx.beginPath()
  ctx.arc(a.sx, a.sy, 4, 0, Math.PI * 2)
  ctx.fill()
  if (!chainCursor) return
  const b = camera.worldToScreen(chainCursor.u, chainCursor.v)
  ctx.strokeStyle = theme.nodeSelected
  ctx.lineWidth = 2
  ctx.setLineDash([5, 4])
  ctx.beginPath()
  ctx.moveTo(a.sx, a.sy)
  ctx.lineTo(b.sx, b.sy)
  ctx.stroke()
  ctx.setLineDash([])
  const length = Math.hypot(chainCursor.u - chainLast.u, chainCursor.v - chainLast.v)
  if (length > 0.1) {
    ctx.fillStyle = theme.nodeSelected
    ctx.font = 'bold 11px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`${length.toFixed(1)}m`, (a.sx + b.sx) / 2, (a.sy + b.sy) / 2 - 8)
  }
}

function drawDropGhost(p: Paint2DContext): void {
  if (!p.dropGhost) return
  const { ctx, camera, theme, isElevation, dropGhost } = p
  const item = dropGhost.item
  const { wu, wv } = p.footprintSize(item)
  const w = wu * camera.scale
  const d = wv * camera.scale
  const cv = isElevation ? dropGhost.v + wv / 2 : dropGhost.v
  const { sx, sy } = camera.worldToScreen(dropGhost.u, cv)
  const denied = dropGhost.colliding
  const color =
    typeof item.thumb === 'string' && item.thumb.startsWith('#') ? item.thumb : theme.nodeSelected

  ctx.save()
  ctx.translate(sx, sy)
  ctx.rotate(isElevation ? dropGhost.yaw : -dropGhost.yaw)
  ctx.globalAlpha = 0.45
  ctx.fillStyle = denied ? theme.nodeDenied : color
  ctx.fillRect(-w / 2, -d / 2, w, d)
  ctx.globalAlpha = 1
  ctx.lineWidth = 2
  ctx.strokeStyle = denied ? theme.nodeDenied : theme.nodeSelected
  ctx.setLineDash([4, 3])
  ctx.strokeRect(-w / 2, -d / 2, w, d)
  ctx.setLineDash([])
  ctx.restore()
}

function drawNodes(p: Paint2DContext): void {
  const { ctx, camera, doc, theme, select, tool, readonly, isElevation } = p
  const selection = doc.selection.get()
  doc.getNodes().forEach(node => {
    const item = p.itemFor(node)
    const { wu, wv } = p.footprintSize(item)
    const w = wu * camera.scale
    const d = wv * camera.scale

    let plane = p.planeFromPosition(node.transform.position)
    const dragging = node.id === select.dragNodeId && select.dragGhost
    if (dragging) plane = select.dragGhost!

    const cv = isElevation ? plane.v + wv / 2 : plane.v
    const { sx, sy } = camera.worldToScreen(plane.u, cv)
    const rotating = node.id === select.rotateNodeId && select.rotateMoved
    const angle = rotating
      ? select.rotateGhostYaw
      : isElevation
        ? node.transform.rotation[2]
        : node.transform.rotation[1]
    const selected = selection.includes(node.id)
    const denied =
      (dragging && select.dragColliding) || (rotating && select.rotateColliding)

    ctx.save()
    ctx.translate(sx, sy)
    ctx.rotate(isElevation ? angle : -angle)
    const color = typeof item?.thumb === 'string' && item.thumb.startsWith('#') ? item.thumb : theme.node
    ctx.fillStyle = denied ? theme.nodeDenied : color
    ctx.globalAlpha = dragging || rotating ? 0.55 : 0.9
    ctx.fillRect(-w / 2, -d / 2, w, d)
    ctx.globalAlpha = 1
    ctx.lineWidth = selected ? 2.5 : 1
    ctx.strokeStyle = denied
      ? theme.nodeDenied
      : selected
        ? theme.nodeSelected
        : 'rgba(255,255,255,0.35)'
    ctx.strokeRect(-w / 2, -d / 2, w, d)
    ctx.beginPath()
    ctx.moveTo(0, -d / 2)
    ctx.lineTo(0, -d / 2 - Math.min(10, d / 4))
    ctx.stroke()
    ctx.restore()

    if (selected && tool === 'select' && !readonly) {
      drawRotateHandle(p, node)
    }

    if (camera.scale > 14 && node.name) {
      ctx.fillStyle = theme.label
      ctx.font = '11px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(node.name, sx, sy + d / 2 + 13)
    }
  })
}

function drawRotateHandle(p: Paint2DContext, node: EditorNodeJSON): void {
  const layout = p.select.layoutFor(node)
  const center = p.camera.worldToScreen(layout.center.u, layout.center.v)
  const handle = p.camera.worldToScreen(layout.handle.u, layout.handle.v)
  const radiusPx = layout.reach * p.camera.scale
  const denied = node.id === p.select.rotateNodeId && p.select.rotateColliding
  const color = denied ? p.theme.nodeDenied : p.theme.nodeSelected
  const ctx = p.ctx

  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.globalAlpha = 0.85
  ctx.beginPath()
  ctx.arc(center.sx, center.sy, radiusPx, 0, Math.PI * 2)
  ctx.stroke()

  ctx.globalAlpha = 1
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(handle.sx, handle.sy, 6, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.restore()
}

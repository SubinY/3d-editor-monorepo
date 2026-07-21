<template>
  <div class="layout-canvas-wrap" ref="wrapRef">
    <canvas
      ref="canvasRef"
      class="layout-canvas"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @dragover.prevent
      @drop.prevent="onDrop"
    />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { resourceStore } from '@/stores/resource-store'
import type { Layout2DItem } from '@/stores/asset-store'
import { useAssetEditor } from '../composables/useAssetEditor'

interface BoardRect {
  x: number
  y: number
  width: number
  height: number
}

interface DragState {
  itemId: string
  startXmm: number
  startYmm: number
  pointerXmm: number
  pointerYmm: number
}

const editor = useAssetEditor()
const wrapRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)

const boardRect = ref<BoardRect>({ x: 0, y: 0, width: 0, height: 0 })
const symbolImages = new Map<string, HTMLImageElement>()
const symbolLoading = new Map<string, Promise<HTMLImageElement | null>>()

let dragState: DragState | null = null
let resizeObserver: ResizeObserver | null = null
let rafId = 0

function scheduleDraw() {
  if (rafId) return
  rafId = window.requestAnimationFrame(() => {
    rafId = 0
    draw()
  })
}

function computeBoardRect(viewportWidth: number, viewportHeight: number): BoardRect {
  const [boardWmm, boardHmm] = editor.boardSizeMm.value
  const safeWmm = Math.max(1, boardWmm)
  const safeHmm = Math.max(1, boardHmm)
  const padding = 24
  const usableW = Math.max(40, viewportWidth - padding * 2)
  const usableH = Math.max(40, viewportHeight - padding * 2)
  const boardAspect = safeWmm / safeHmm

  let width = usableW
  let height = width / boardAspect
  if (height > usableH) {
    height = usableH
    width = height * boardAspect
  }

  return {
    x: (viewportWidth - width) / 2,
    y: (viewportHeight - height) / 2,
    width,
    height
  }
}

function resizeCanvas() {
  const wrap = wrapRef.value
  const canvas = canvasRef.value
  if (!wrap || !canvas) return

  const rect = wrap.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.max(1, Math.floor(rect.width * dpr))
  canvas.height = Math.max(1, Math.floor(rect.height * dpr))
  canvas.style.width = `${Math.floor(rect.width)}px`
  canvas.style.height = `${Math.floor(rect.height)}px`
  boardRect.value = computeBoardRect(rect.width, rect.height)
  scheduleDraw()
}

function mmToCanvas(item: Layout2DItem) {
  const [boardWmm, boardHmm] = editor.boardSizeMm.value
  const safeWmm = Math.max(1, boardWmm)
  const safeHmm = Math.max(1, boardHmm)
  const rect = boardRect.value
  return {
    x: rect.x + (item.xMm / safeWmm) * rect.width,
    y: rect.y + (item.yMm / safeHmm) * rect.height,
    w: Math.max(1, (item.widthMm / safeWmm) * rect.width),
    h: Math.max(1, (item.heightMm / safeHmm) * rect.height)
  }
}

function pointToMm(x: number, y: number): [number, number] {
  const rect = boardRect.value
  const [boardWmm, boardHmm] = editor.boardSizeMm.value
  const rx = rect.width > 0 ? (x - rect.x) / rect.width : 0
  const ry = rect.height > 0 ? (y - rect.y) / rect.height : 0
  const clampedX = Math.min(Math.max(rx, 0), 1)
  const clampedY = Math.min(Math.max(ry, 0), 1)
  return [clampedX * boardWmm, clampedY * boardHmm]
}

function getPointerPos(event: PointerEvent | DragEvent): [number, number] {
  const canvas = canvasRef.value
  if (!canvas) return [0, 0]
  const rect = canvas.getBoundingClientRect()
  return [event.clientX - rect.left, event.clientY - rect.top]
}

function isPointInItem(px: number, py: number, item: Layout2DItem): boolean {
  const frame = mmToCanvas(item)
  const cx = frame.x + frame.w / 2
  const cy = frame.y + frame.h / 2
  const rad = (item.rotationDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const dx = px - cx
  const dy = py - cy

  const localX = dx * cos + dy * sin
  const localY = -dx * sin + dy * cos
  return Math.abs(localX) <= frame.w / 2 && Math.abs(localY) <= frame.h / 2
}

function hitTest(px: number, py: number): Layout2DItem | null {
  const items = editor.layoutItems.value
  for (let i = items.length - 1; i >= 0; i -= 1) {
    if (isPointInItem(px, py, items[i])) return items[i]
  }
  return null
}

async function ensureSymbolImages() {
  const parts = editor.partSpecs.value
  for (const part of parts) {
    const key = part.id
    const resourceId = part.symbolResourceId
    if (!resourceId || symbolImages.has(key) || symbolLoading.has(key)) continue

    const task = (async () => {
      const blob = await resourceStore.getBlob(resourceId)
      if (!blob) return null

      const url = URL.createObjectURL(blob)
      try {
        const image = new Image()
        image.src = url
        await image.decode()
        symbolImages.set(key, image)
        return image
      } catch {
        return null
      } finally {
        URL.revokeObjectURL(url)
      }
    })()

    symbolLoading.set(key, task)
    await task
    symbolLoading.delete(key)
  }
  scheduleDraw()
}

function drawGrid(ctx: CanvasRenderingContext2D, rect: BoardRect) {
  const [boardWmm, boardHmm] = editor.boardSizeMm.value
  const gridMm = 100
  const stepX = (gridMm / Math.max(1, boardWmm)) * rect.width
  const stepY = (gridMm / Math.max(1, boardHmm)) * rect.height

  ctx.save()
  ctx.beginPath()
  ctx.rect(rect.x, rect.y, rect.width, rect.height)
  ctx.clip()

  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.lineWidth = 1

  for (let x = rect.x + stepX; x < rect.x + rect.width; x += stepX) {
    ctx.beginPath()
    ctx.moveTo(x, rect.y)
    ctx.lineTo(x, rect.y + rect.height)
    ctx.stroke()
  }

  for (let y = rect.y + stepY; y < rect.y + rect.height; y += stepY) {
    ctx.beginPath()
    ctx.moveTo(rect.x, y)
    ctx.lineTo(rect.x + rect.width, y)
    ctx.stroke()
  }

  ctx.restore()
}

function drawItem(ctx: CanvasRenderingContext2D, item: Layout2DItem) {
  const frame = mmToCanvas(item)
  const selected = editor.selectedLayoutItemId.value === item.id
  const image = symbolImages.get(item.componentId)

  ctx.save()
  ctx.translate(frame.x + frame.w / 2, frame.y + frame.h / 2)
  ctx.rotate((item.rotationDeg * Math.PI) / 180)

  ctx.fillStyle = 'rgba(77,163,255,0.16)'
  ctx.strokeStyle = item.color || '#4da3ff'
  ctx.lineWidth = selected ? 2.5 : 1.2
  ctx.beginPath()
  ctx.roundRect(-frame.w / 2, -frame.h / 2, frame.w, frame.h, 6)
  ctx.fill()
  ctx.stroke()

  if (image) {
    ctx.drawImage(image, -frame.w / 2 + 2, -frame.h / 2 + 2, frame.w - 4, frame.h - 4)
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.font = `600 ${Math.max(11, Math.min(frame.h * 0.28, 18))}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(item.name, 0, 0, Math.max(10, frame.w - 8))
  }

  if (selected) {
    ctx.strokeStyle = 'rgba(255,255,255,0.95)'
    ctx.lineWidth = 1
    ctx.strokeRect(-frame.w / 2 + 2, -frame.h / 2 + 2, frame.w - 4, frame.h - 4)
  }

  ctx.restore()
}

function draw() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = window.devicePixelRatio || 1
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr)

  const rect = boardRect.value
  ctx.fillStyle = '#0f172c'
  ctx.strokeStyle = 'rgba(77,163,255,0.45)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.roundRect(rect.x, rect.y, rect.width, rect.height, 10)
  ctx.fill()
  ctx.stroke()

  drawGrid(ctx, rect)

  for (const item of editor.layoutItems.value) {
    drawItem(ctx, item)
  }

  ctx.fillStyle = 'rgba(220,230,255,0.85)'
  ctx.font = '12px sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  const [boardWmm, boardHmm] = editor.boardSizeMm.value
  ctx.fillText(`安装板：${Math.round(boardWmm)} x ${Math.round(boardHmm)} mm`, rect.x + 12, rect.y + 10)
}

function onPointerDown(event: PointerEvent) {
  const canvas = canvasRef.value
  if (!canvas) return

  const [px, py] = getPointerPos(event)
  const item = hitTest(px, py)
  if (!item) {
    editor.selectLayoutItem(null)
    dragState = null
    scheduleDraw()
    return
  }

  editor.selectLayoutItem(item.id)
  const [pointerXmm, pointerYmm] = pointToMm(px, py)
  dragState = {
    itemId: item.id,
    startXmm: item.xMm,
    startYmm: item.yMm,
    pointerXmm,
    pointerYmm
  }

  canvas.setPointerCapture(event.pointerId)
  scheduleDraw()
}

function onPointerMove(event: PointerEvent) {
  if (!dragState) return
  const [px, py] = getPointerPos(event)
  const [xMm, yMm] = pointToMm(px, py)
  const dx = xMm - dragState.pointerXmm
  const dy = yMm - dragState.pointerYmm
  editor.updateLayoutItem(dragState.itemId, {
    xMm: dragState.startXmm + dx,
    yMm: dragState.startYmm + dy
  })
}

function onPointerUp(event: PointerEvent) {
  const canvas = canvasRef.value
  if (canvas?.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId)
  }
  dragState = null
}

function onDrop(event: DragEvent) {
  const partId = event.dataTransfer?.getData('part-id')
  if (!partId) return

  editor.addLayoutItem(partId)
  const createdId = editor.selectedLayoutItemId.value
  if (!createdId) return
  const created = editor.layoutItems.value.find(item => item.id === createdId)
  if (!created) return

  const [px, py] = getPointerPos(event)
  const [xMm, yMm] = pointToMm(px, py)
  editor.updateLayoutItem(createdId, {
    xMm: xMm - created.widthMm / 2,
    yMm: yMm - created.heightMm / 2
  })
}

watch(
  () => [editor.boardSizeMm.value[0], editor.boardSizeMm.value[1], editor.selectedLayoutItemId.value, editor.layoutItems.value],
  () => scheduleDraw(),
  { deep: true }
)

watch(
  () => editor.partSpecs.value.map(part => `${part.id}:${part.symbolResourceId || ''}`),
  () => {
    void ensureSymbolImages()
  },
  { immediate: true }
)

onMounted(() => {
  resizeCanvas()
  resizeObserver = new ResizeObserver(() => resizeCanvas())
  if (wrapRef.value) resizeObserver.observe(wrapRef.value)
  void ensureSymbolImages()
})

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (rafId) window.cancelAnimationFrame(rafId)
})
</script>

<style scoped>
.layout-canvas-wrap {
  flex: 1;
  display: flex;
  background: radial-gradient(circle at 30% 20%, rgba(77, 163, 255, 0.13), transparent 48%), var(--color-bg);
  overflow: hidden;
}

.layout-canvas {
  width: 100%;
  height: 100%;
  touch-action: none;
  cursor: default;
}
</style>

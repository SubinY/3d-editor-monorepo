<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { panel } from '@mh/3d-editor-assets/common'
import { PANEL_TOOL_MIME } from './constants'

const props = defineProps<{
  previewUrl: string
  draft: panel.PanelContentJSON
  selectedId: string
}>()

const emit = defineEmits<{
  dropTool: [payload: { kind: 'text' | 'image'; left: number; top: number }]
  select: [id: string]
  change: []
  'update:selectedId': [id: string]
}>()

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

const frameRef = ref<HTMLElement | null>(null)
const imgRef = ref<HTMLImageElement | null>(null)
const frameSize = ref({ w: 0, h: 0 })

let drag:
  | {
      mode: 'move' | 'resize'
      id: string
      handle?: Handle
      startX: number
      startY: number
      orig: { left: number; top: number; width: number; height: number }
    }
  | null = null

let bakeTimer: ReturnType<typeof setTimeout> | null = null

const sx = computed(() => frameSize.value.w / Math.max(props.draft.width, 1))
const sy = computed(() => frameSize.value.h / Math.max(props.draft.height, 1))

function measure() {
  const img = imgRef.value
  if (!img) {
    frameSize.value = { w: 0, h: 0 }
    return
  }
  frameSize.value = { w: img.clientWidth, h: img.clientHeight }
}

onMounted(() => {
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('resize', measure)
})

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('resize', measure)
  if (bakeTimer) clearTimeout(bakeTimer)
})

watch(
  () => props.previewUrl,
  async () => {
    await nextTick()
    measure()
  }
)

function findEl(id: string) {
  return props.draft.elements.find(e => e.id === id)
}

function scheduleBake() {
  if (bakeTimer) clearTimeout(bakeTimer)
  bakeTimer = setTimeout(() => emit('change'), 80)
}

function flushBake() {
  if (bakeTimer) clearTimeout(bakeTimer)
  bakeTimer = null
  emit('change')
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
}

function clientToPanel(clientX: number, clientY: number) {
  const frame = frameRef.value
  if (!frame) return { x: 0, y: 0 }
  const rect = frame.getBoundingClientRect()
  return {
    x: ((clientX - rect.left) / Math.max(rect.width, 1)) * props.draft.width,
    y: ((clientY - rect.top) / Math.max(rect.height, 1)) * props.draft.height
  }
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  const kind = e.dataTransfer?.getData(PANEL_TOOL_MIME) as 'text' | 'image' | ''
  if (kind !== 'text' && kind !== 'image') return
  const p = clientToPanel(e.clientX, e.clientY)
  const left = Math.round(p.x - (kind === 'text' ? 200 : 60))
  const top = Math.round(p.y - (kind === 'text' ? 40 : 60))
  emit('dropTool', { kind, left: Math.max(0, left), top: Math.max(0, top) })
}

function onBgPointerDown(e: PointerEvent) {
  if (e.button !== 0) return
  emit('update:selectedId', '')
}

function startMove(e: PointerEvent, id: string) {
  if (e.button !== 0) return
  e.stopPropagation()
  e.preventDefault()
  const el = findEl(id)
  if (!el) return
  emit('update:selectedId', id)
  drag = {
    mode: 'move',
    id,
    startX: e.clientX,
    startY: e.clientY,
    orig: { left: el.left, top: el.top, width: el.width, height: el.height }
  }
}

function startResize(e: PointerEvent, id: string, handle: Handle) {
  if (e.button !== 0) return
  e.stopPropagation()
  e.preventDefault()
  const el = findEl(id)
  if (!el) return
  emit('update:selectedId', id)
  drag = {
    mode: 'resize',
    id,
    handle,
    startX: e.clientX,
    startY: e.clientY,
    orig: { left: el.left, top: el.top, width: el.width, height: el.height }
  }
}

function onPointerMove(e: PointerEvent) {
  if (!drag) return
  const el = findEl(drag.id)
  if (!el) return
  const dx = (e.clientX - drag.startX) / Math.max(sx.value, 0.0001)
  const dy = (e.clientY - drag.startY) / Math.max(sy.value, 0.0001)
  const o = drag.orig
  const min = 16

  if (drag.mode === 'move') {
    el.left = Math.round(o.left + dx)
    el.top = Math.round(o.top + dy)
  } else if (drag.handle) {
    let left = o.left
    let top = o.top
    let width = o.width
    let height = o.height
    const h = drag.handle
    if (h.includes('e')) width = Math.max(min, o.width + dx)
    if (h.includes('s')) height = Math.max(min, o.height + dy)
    if (h.includes('w')) {
      width = Math.max(min, o.width - dx)
      left = o.left + (o.width - width)
    }
    if (h.includes('n')) {
      height = Math.max(min, o.height - dy)
      top = o.top + (o.height - height)
    }
    el.left = Math.round(left)
    el.top = Math.round(top)
    el.width = Math.round(width)
    el.height = Math.round(height)
  }
  scheduleBake()
}

function onPointerUp() {
  if (!drag) return
  drag = null
  flushBake()
}

const handles: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
</script>

<template>
  <main class="canvas">
    <div class="stage" @dragover="onDragOver" @drop="onDrop">
      <div
        v-if="previewUrl"
        ref="frameRef"
        class="frame"
        @pointerdown="onBgPointerDown"
      >
        <img
          ref="imgRef"
          class="preview"
          :src="previewUrl"
          alt="panel preview"
          draggable="false"
          @load="measure"
        />
        <div class="overlay" :style="{ width: frameSize.w + 'px', height: frameSize.h + 'px' }">
          <div
            v-for="el in draft.elements"
            :key="el.id"
            class="box"
            :class="{ active: el.id === selectedId }"
            :style="{
              left: el.left * sx + 'px',
              top: el.top * sy + 'px',
              width: el.width * sx + 'px',
              height: el.height * sy + 'px'
            }"
            @pointerdown="startMove($event, el.id)"
          >
            <template v-if="el.id === selectedId">
              <div
                v-for="h in handles"
                :key="h"
                class="handle"
                :class="h"
                @pointerdown="startResize($event, el.id, h)"
              />
            </template>
          </div>
        </div>
      </div>
      <div v-else class="empty">拖入左侧组件开始编辑</div>
    </div>
    <div class="hint">拖动元素移动；选中后拖控制点缩放。点击空白取消选中。</div>
  </main>
</template>

<style scoped>
.canvas {
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: #0b1118;
}

.stage {
  flex: 1;
  display: grid;
  place-items: center;
  padding: 16px;
  min-height: 0;
  overflow: auto;
}

.frame {
  position: relative;
  display: inline-block;
  max-width: 100%;
  max-height: 100%;
  line-height: 0;
}

.preview {
  max-width: min(100%, 100%);
  max-height: calc(92vh - 220px);
  width: auto;
  height: auto;
  image-rendering: auto;
  background: repeating-conic-gradient(#1a2430 0% 25%, #101820 0% 50%) 50% / 16px 16px;
  pointer-events: none;
  user-select: none;
}

.overlay {
  position: absolute;
  left: 0;
  top: 0;
  pointer-events: none;
}

.box {
  position: absolute;
  box-sizing: border-box;
  border: 1px solid transparent;
  pointer-events: auto;
  cursor: move;
}

.box.active {
  border-color: #3b82f6;
  box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.35);
}

.handle {
  position: absolute;
  width: 8px;
  height: 8px;
  background: #fff;
  border: 1px solid #3b82f6;
  border-radius: 1px;
  pointer-events: auto;
  z-index: 2;
}

.handle.nw { left: -4px; top: -4px; cursor: nwse-resize; }
.handle.ne { right: -4px; top: -4px; cursor: nesw-resize; }
.handle.sw { left: -4px; bottom: -4px; cursor: nesw-resize; }
.handle.se { right: -4px; bottom: -4px; cursor: nwse-resize; }
.handle.n { left: 50%; top: -4px; margin-left: -4px; cursor: ns-resize; }
.handle.s { left: 50%; bottom: -4px; margin-left: -4px; cursor: ns-resize; }
.handle.w { left: -4px; top: 50%; margin-top: -4px; cursor: ew-resize; }
.handle.e { right: -4px; top: 50%; margin-top: -4px; cursor: ew-resize; }

.empty {
  color: #6b7f94;
  font-size: 13px;
}

.hint {
  padding: 8px 12px;
  font-size: 11px;
  color: #8aa0b5;
  border-top: 1px solid #243041;
}
</style>

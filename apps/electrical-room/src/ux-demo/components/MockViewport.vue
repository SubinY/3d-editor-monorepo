<script setup lang="ts">
import { computed } from 'vue'
import type { EditorTool, MockAsset, MockNode, ViewMode } from '../mock-data'
import { ROOM, statusColor } from '../mock-data'
import ContextToolbar from './ContextToolbar.vue'
import MiniMap from './MiniMap.vue'

const props = defineProps<{
  nodes: MockNode[]
  selectedId: string | null
  viewMode: ViewMode
  activeTool: EditorTool
  measureEnabled: boolean
  snapEnabled: boolean
  placePreview: { asset: MockAsset; x: number; z: number } | null
  wallLines: Array<{ x1: number; z1: number; x2: number; z2: number }>
  assets: MockAsset[]
}>()

const emit = defineEmits<{
  select: [id: string | null]
  'open-interior': []
  move: []
  rotate: []
  duplicate: []
  delete: []
  place: [asset: MockAsset, x: number, z: number]
  'preview-place': [asset: MockAsset, x: number, z: number] | [null]
  'wall-point': [x: number, z: number]
  'end-wall': []
}>()

const selected = computed(() => props.nodes.find(n => n.id === props.selectedId) ?? null)

/** 俯视坐标 → CSS 百分比（假等轴测容器内） */
function styleFor(n: { x: number; z: number; w: number; d: number; h: number; yawDeg: number; color: string }) {
  const left = (n.x / ROOM.width) * 100
  const top = (n.z / ROOM.depth) * 100
  const width = Math.max(3.5, (n.w / ROOM.width) * 100)
  const depth = Math.max(2.5, (n.d / ROOM.depth) * 100)
  const heightPx = Math.max(28, n.h * 36)
  return {
    left: `${left}%`,
    top: `${top}%`,
    width: `${width}%`,
    height: `${heightPx}px`,
    '--depth': `${depth}%`,
    background: n.color,
    transform: `translate(-50%, -100%) rotateZ(${n.yawDeg * 0.15}deg)`
  }
}

function clientToWorld(e: DragEvent | MouseEvent, el: HTMLElement) {
  const rect = el.getBoundingClientRect()
  const x = ((e.clientX - rect.left) / rect.width) * ROOM.width
  const z = ((e.clientY - rect.top) / rect.height) * ROOM.depth
  return {
    x: Math.min(ROOM.width - 0.2, Math.max(0.2, x)),
    z: Math.min(ROOM.depth - 0.2, Math.max(0.2, z))
  }
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  const id = e.dataTransfer?.getData('application/ux-demo-asset')
  const asset = props.assets.find(a => a.id === id)
  if (!asset) return
  const world = clientToWorld(e, e.currentTarget as HTMLElement)
  emit('place', asset, world.x, world.z)
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
  const id = e.dataTransfer?.types.includes('application/ux-demo-asset')
  if (!id) return
  // preview via last known asset from drag — parent holds placePreview from dragstart
  const world = clientToWorld(e, e.currentTarget as HTMLElement)
  if (props.placePreview) {
    emit('preview-place', props.placePreview.asset, world.x, world.z)
  }
}

function onBgClick(e: MouseEvent) {
  if ((e.target as HTMLElement).closest('.cab')) return
  if (props.activeTool === 'wall' && (props.viewMode === '2d' || props.viewMode === 'split')) {
    const world = clientToWorld(e, e.currentTarget as HTMLElement)
    emit('wall-point', world.x, world.z)
    return
  }
  emit('select', null)
}

function onBgContext(e: MouseEvent) {
  if (props.activeTool === 'wall') {
    e.preventDefault()
    emit('end-wall')
  }
}

const measurePairs = computed(() => {
  if (!props.measureEnabled || props.nodes.length < 2) return []
  const a = props.nodes[0]
  const b = props.nodes[1]
  const dist = Math.hypot(a.x - b.x, a.z - b.z)
  return [{ a, b, dist }]
})
</script>

<template>
  <div class="vp-wrap">
    <ContextToolbar
      :visible="!!selected"
      :label="selected?.name"
      @move="emit('move')"
      @rotate="emit('rotate')"
      @duplicate="emit('duplicate')"
      @delete="emit('delete')"
      @interior="emit('open-interior')"
    />

    <div class="views" :class="viewMode">
      <div
        v-if="viewMode === '2d' || viewMode === 'split'"
        class="pane pane-2d"
        @click="onBgClick"
        @contextmenu="onBgContext"
        @dragover="onDragOver"
        @drop="onDrop"
      >
        <div class="floor-2d">
          <svg class="walls" viewBox="0 0 12 10" preserveAspectRatio="none">
            <line
              v-for="(w, i) in wallLines"
              :key="i"
              :x1="w.x1"
              :y1="w.z1"
              :x2="w.x2"
              :y2="w.z2"
              stroke="#7dd3fc"
              stroke-width="0.08"
            />
          </svg>
          <button
            v-for="n in nodes"
            :key="'2d-' + n.id"
            type="button"
            class="cab flat"
            :class="{ on: n.id === selectedId }"
            :style="{
              left: `${(n.x / ROOM.width) * 100}%`,
              top: `${(n.z / ROOM.depth) * 100}%`,
              width: `${(n.w / ROOM.width) * 100}%`,
              height: `${(n.d / ROOM.depth) * 100}%`,
              background: n.color,
              transform: `translate(-50%, -50%) rotate(${n.yawDeg}deg)`
            }"
            @click.stop="emit('select', n.id)"
            @dblclick.stop="emit('open-interior')"
          />
          <div
            v-if="placePreview"
            class="ghost"
            :style="{
              left: `${(placePreview.x / ROOM.width) * 100}%`,
              top: `${(placePreview.z / ROOM.depth) * 100}%`,
              width: `${(placePreview.asset.w / ROOM.width) * 100}%`,
              height: `${(placePreview.asset.d / ROOM.depth) * 100}%`
            }"
          >
            <span>{{ snapEnabled ? '吸附预览' : '放置预览' }} · {{ (placePreview.asset.w * 1000).toFixed(0) }} 毫米</span>
          </div>
          <svg v-if="measureEnabled" class="measure" viewBox="0 0 12 10" preserveAspectRatio="none">
            <template v-for="(m, i) in measurePairs" :key="i">
              <line
                :x1="m.a.x"
                :y1="m.a.z"
                :x2="m.b.x"
                :y2="m.b.z"
                stroke="#fbbf24"
                stroke-width="0.04"
                stroke-dasharray="0.15 0.1"
              />
              <text :x="(m.a.x + m.b.x) / 2" :y="(m.a.z + m.b.z) / 2 - 0.2" fill="#fbbf24" font-size="0.35">
                {{ (m.dist * 1000).toFixed(0) }} 毫米
              </text>
            </template>
          </svg>
        </div>
        <div class="pane-tag">二维平面图</div>
      </div>

      <div
        v-if="viewMode === '3d' || viewMode === 'split'"
        class="pane pane-3d"
        @click="onBgClick"
        @contextmenu="onBgContext"
        @dragover="onDragOver"
        @drop="onDrop"
      >
        <div class="iso">
          <div class="room">
            <div class="wall back" />
            <div class="wall left" />
            <div class="floor-grid" />
            <button
              v-for="n in nodes"
              :key="n.id"
              type="button"
              class="cab iso-cab"
              :class="{ on: n.id === selectedId }"
              :style="styleFor(n)"
              @click.stop="emit('select', n.id)"
              @dblclick.stop="emit('open-interior')"
            >
              <i class="status" :style="{ background: statusColor(n.status) }" />
              <span class="cap">{{ n.name }}</span>
            </button>
            <div
              v-if="placePreview && viewMode !== '2d'"
              class="ghost iso-ghost"
              :style="
                styleFor({
                  ...placePreview,
                  w: placePreview.asset.w,
                  d: placePreview.asset.d,
                  h: placePreview.asset.h,
                  yawDeg: 0,
                  color: 'transparent'
                })
              "
            >
              <span>{{ (placePreview.asset.w * 1000).toFixed(0) }} 毫米</span>
            </div>
          </div>
        </div>
        <div class="pane-tag">三维视口 · 示意</div>
        <div class="axis">
          <span class="x">X</span>
          <span class="y">Y</span>
          <span class="z">Z</span>
        </div>
      </div>
    </div>

    <MiniMap :nodes="nodes" :selected-id="selectedId" @select="emit('select', $event)" />
  </div>
</template>

<style scoped>
.vp-wrap {
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 0;
  background: radial-gradient(ellipse at 40% 20%, #1a2a40 0%, #0a1018 55%, #070b12 100%);
  overflow: hidden;
}
.views {
  display: flex;
  height: 100%;
}
.views.split .pane {
  width: 50%;
}
.views:not(.split) .pane {
  width: 100%;
}
.pane {
  position: relative;
  height: 100%;
  border-right: 1px solid #1c2a3d;
}
.pane-tag {
  position: absolute;
  top: 10px;
  left: 12px;
  font-size: 11px;
  color: #7b90a8;
  background: rgba(0, 0, 0, 0.35);
  padding: 3px 8px;
  border-radius: 6px;
  pointer-events: none;
}
.pane-2d {
  background: #0d1520;
}
.floor-2d {
  position: absolute;
  inset: 24px;
  background:
    linear-gradient(rgba(61, 214, 255, 0.08) 1px, transparent 1px) 0 0 / 40px 40px,
    linear-gradient(90deg, rgba(61, 214, 255, 0.08) 1px, transparent 1px) 0 0 / 40px 40px,
    #121c2a;
  border: 1px solid #223247;
  border-radius: 8px;
}
.walls,
.measure {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.cab {
  position: absolute;
  border: 1px solid rgba(255, 255, 255, 0.2);
  cursor: pointer;
  padding: 0;
}
.cab.flat {
  border-radius: 2px;
}
.cab.on {
  outline: 2px solid #3dd6ff;
  box-shadow: 0 0 16px rgba(61, 214, 255, 0.45);
  z-index: 3;
}
.iso {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  perspective: 900px;
}
.room {
  position: relative;
  width: min(78%, 720px);
  height: min(70%, 420px);
  transform: rotateX(52deg) rotateZ(-28deg);
  transform-style: preserve-3d;
}
.floor-grid {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(rgba(120, 160, 200, 0.18) 1px, transparent 1px) 0 0 / 28px 28px,
    linear-gradient(90deg, rgba(120, 160, 200, 0.18) 1px, transparent 1px) 0 0 / 28px 28px,
    #2a3544;
  border: 1px solid #3d4d60;
  box-shadow: 0 30px 50px rgba(0, 0, 0, 0.45);
}
.wall.back {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 100%;
  height: 120px;
  background: linear-gradient(#4a5a6c, #3a4858);
  transform-origin: bottom;
  transform: rotateX(-90deg);
  opacity: 0.85;
}
.wall.left {
  position: absolute;
  top: 0;
  bottom: 0;
  right: 100%;
  width: 120px;
  background: linear-gradient(90deg, #3a4656, #4a5868);
  transform-origin: right;
  transform: rotateY(90deg);
  opacity: 0.8;
}
.iso-cab {
  border-radius: 3px 3px 0 0;
  box-shadow:
    4px 0 0 rgba(0, 0, 0, 0.25),
    0 8px 16px rgba(0, 0, 0, 0.35);
  background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.12), transparent 40%);
}
.status {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
}
.cap {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 4px);
  transform: translateX(-50%) rotateZ(28deg) rotateX(-52deg);
  font-size: 10px;
  color: #c5d4e6;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
}
.iso-cab.on .cap,
.iso-cab:hover .cap {
  opacity: 1;
}
.ghost {
  position: absolute;
  transform: translate(-50%, -50%);
  border: 2px dashed #3dd6ff;
  background: rgba(61, 214, 255, 0.12);
  pointer-events: none;
  z-index: 4;
  display: grid;
  place-items: center;
}
.ghost span {
  font-size: 10px;
  color: #7dd3fc;
  white-space: nowrap;
}
.iso-ghost {
  transform: translate(-50%, -100%);
  height: 60px !important;
}
.axis {
  position: absolute;
  right: 18px;
  top: 18px;
  width: 54px;
  height: 54px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid #2a3c52;
}
.axis span {
  position: absolute;
  font-size: 10px;
  font-weight: 700;
}
.axis .x {
  color: #ef4444;
  right: 8px;
  top: 50%;
}
.axis .y {
  color: #22c55e;
  left: 50%;
  top: 8px;
}
.axis .z {
  color: #3b82f6;
  left: 8px;
  bottom: 10px;
}
</style>

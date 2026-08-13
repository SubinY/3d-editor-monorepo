<script setup lang="ts">
import { computed, ref } from 'vue'
import type { panel } from '@mh/3d-editor-assets/common'
import { PANEL_TOOL_MIME } from './constants'

const LAYER_MIME = 'application/x-mh-panel-layer'

const props = defineProps<{
  elements: panel.PanelElement[]
  selectedId: string
}>()

const emit = defineEmits<{
  select: [id: string]
  reorder: [ids: string[]]
}>()

/** 列表上方 = 画面上层（数组末尾） */
const displayLayers = computed(() => [...props.elements].reverse())

const dragFromId = ref('')

function onToolDragStart(e: DragEvent, kind: 'text' | 'image') {
  if (!e.dataTransfer) return
  e.dataTransfer.setData(PANEL_TOOL_MIME, kind)
  e.dataTransfer.effectAllowed = 'copy'
}

function onLayerDragStart(e: DragEvent, id: string) {
  dragFromId.value = id
  if (!e.dataTransfer) return
  e.dataTransfer.setData(LAYER_MIME, id)
  e.dataTransfer.effectAllowed = 'move'
}

function onLayerDragOver(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
}

function onLayerDrop(e: DragEvent, targetId: string) {
  e.preventDefault()
  e.stopPropagation()
  const fromId = e.dataTransfer?.getData(LAYER_MIME) || dragFromId.value
  dragFromId.value = ''
  if (!fromId || fromId === targetId) return
  const display = displayLayers.value.map(el => el.id)
  const from = display.indexOf(fromId)
  const to = display.indexOf(targetId)
  if (from < 0 || to < 0) return
  display.splice(from, 1)
  display.splice(to, 0, fromId)
  // display 上→下 = 顶→底，写回数组底→顶
  emit('reorder', [...display].reverse())
}
</script>

<template>
  <aside class="palette">
    <div class="label">组件</div>
    <div
      class="tool"
      draggable="true"
      title="拖到画布添加文本"
      @dragstart="onToolDragStart($event, 'text')"
    >
      文本
    </div>
    <div
      class="tool"
      draggable="true"
      title="拖到画布添加图片"
      @dragstart="onToolDragStart($event, 'image')"
    >
      图片
    </div>
    <div class="label mt">图层</div>
    <p class="hint">上方图层在前；拖拽可调顺序</p>
    <button
      v-for="el in displayLayers"
      :key="el.id"
      type="button"
      class="layer"
      :class="{ active: el.id === selectedId }"
      draggable="true"
      @click="emit('select', el.id)"
      @dragstart="onLayerDragStart($event, el.id)"
      @dragover="onLayerDragOver"
      @drop="onLayerDrop($event, el.id)"
    >
      {{ el.name || el.type }}
      ·
      {{ el.type === 'text' ? el.text.slice(0, 8) : 'img' }}
    </button>
  </aside>
</template>

<style scoped>
.palette {
  padding: 10px;
  border-right: 1px solid #243041;
  overflow: auto;
}

.label {
  font-size: 11px;
  color: #8aa0b5;
  margin-bottom: 6px;
}

.hint {
  margin: 0 0 8px;
  font-size: 10px;
  color: #6b7f94;
  line-height: 1.4;
}

.mt {
  margin-top: 12px;
}

.tool,
.layer {
  width: 100%;
  height: 32px;
  margin-bottom: 6px;
  border-radius: 4px;
  border: 1px solid #2d3b4c;
  background: #182230;
  color: #e8eef5;
  cursor: grab;
  font-size: 12px;
  display: grid;
  place-items: center;
  user-select: none;
}

.layer {
  cursor: grab;
  text-align: left;
  padding: 0 8px;
  place-items: center start;
}

.layer.active {
  border-color: #3b82f6;
  background: #1d3350;
}

.tool:active,
.layer:active {
  cursor: grabbing;
}
</style>

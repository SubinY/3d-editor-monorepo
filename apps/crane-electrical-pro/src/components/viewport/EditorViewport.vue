<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import type { ViewMode } from '@/stores/editor'

export type Camera3dMode = 'orbit' | 'orthographic'

const props = defineProps<{
  viewMode: ViewMode
  camera3dMode?: Camera3dMode
  scaleLabel?: string
}>()

const emit = defineEmits<{
  'update:viewMode': [mode: ViewMode]
  'update:camera3dMode': [mode: Camera3dMode]
  'fit-2d': []
  'zoom-2d': [direction: 1 | -1]
  screenshot: []
  'enter-indoor': []
}>()

const el2d = ref<HTMLElement>()
const el3d = ref<HTMLElement>()
const shadeMode = ref<'solid' | 'wireframe'>('solid')

defineExpose({ el2d, el3d })

const show2d = computed(() => props.viewMode !== '3d')
const show3d = computed(() => props.viewMode !== '2d')
const camMode = computed(() => props.camera3dMode ?? 'orbit')

async function setMode(mode: ViewMode) {
  emit('update:viewMode', mode)
  await nextTick()
  window.dispatchEvent(new Event('resize'))
}

function setCam(mode: Camera3dMode) {
  emit('update:camera3dMode', mode)
}

watch(
  () => props.viewMode,
  async () => {
    await nextTick()
    window.dispatchEvent(new Event('resize'))
  }
)
</script>

<template>
  <div class="viewport-root">
    <div class="view-bar">
      <div class="modes">
        <button type="button" :class="{ on: viewMode === '2d' }" @click="setMode('2d')">2D</button>
        <button type="button" :class="{ on: viewMode === 'split' }" @click="setMode('split')">
          分屏
        </button>
        <button type="button" :class="{ on: viewMode === '3d' }" @click="setMode('3d')">3D</button>
      </div>
    </div>

    <div class="panes">
      <div v-show="show2d" class="pane">
        <div class="pane-head">
          <span>2D 楼层平面</span>
        </div>
        <div class="canvas-wrap">
          <div ref="el2d" class="canvas-host" />
          <div class="overlay-tools left">
            <button type="button" title="平移：中键 / 右键拖拽" class="tool">
              <Icon icon="mdi:hand-back-left-outline" :width="16" :height="16" />
            </button>
            <button type="button" title="缩小" class="tool" @click="emit('zoom-2d', 1)">
              <Icon icon="mdi:magnify-minus-outline" :width="16" :height="16" />
            </button>
            <button type="button" title="放大" class="tool" @click="emit('zoom-2d', -1)">
              <Icon icon="mdi:magnify-plus-outline" :width="16" :height="16" />
            </button>
          </div>
          <div class="overlay-tools right">
            <button type="button" title="适应窗口" class="tool" @click="emit('fit-2d')">
              <Icon icon="mdi:arrow-expand-all" :width="16" :height="16" />
            </button>
            <span class="scale">{{ scaleLabel || '—' }}</span>
          </div>
        </div>
      </div>

      <div v-show="show3d" class="pane">
        <div class="pane-head">
          <span>3D 视角</span>
          <Icon icon="mdi:cube-outline" :width="16" :height="16" class="muted" />
        </div>
        <div class="canvas-wrap">
          <div ref="el3d" class="canvas-host" />
          <!-- 坐标系角标由内核 WorldViewGizmo 画在画布右下；Host 不改内核位置 -->
          <div class="overlay-bar bottom">
            <div class="seg">
              <button
                type="button"
                :class="{ on: camMode === 'orbit' }"
                @click="setCam('orbit')"
              >
                透视
              </button>
              <button
                type="button"
                :class="{ on: camMode === 'orthographic' }"
                @click="setCam('orthographic')"
              >
                正交
              </button>
              <button type="button" title="进入室内预设视角" @click="emit('enter-indoor')">
                室内
              </button>
              <button
                type="button"
                :class="{ on: shadeMode === 'wireframe' }"
                title="UI 占位：内核暂无线框切换"
                @click="shadeMode = 'wireframe'"
              >
                线框
              </button>
              <button
                type="button"
                :class="{ on: shadeMode === 'solid' }"
                title="UI 占位"
                @click="shadeMode = 'solid'"
              >
                渲染
              </button>
            </div>
            <div class="seg icons">
              <button type="button" class="tool" title="适应 / 网格（占位）">
                <Icon icon="mdi:view-grid-outline" :width="16" :height="16" />
              </button>
              <button type="button" class="tool" title="截图（占位）" @click="emit('screenshot')">
                <Icon icon="mdi:camera-outline" :width="16" :height="16" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.viewport-root {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.view-bar {
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 10px;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-panel);
  flex-shrink: 0;
}

.panes {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 1px;
  background: var(--border-subtle);
}

.pane {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--scene-bg);
}

.pane-head {
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-panel);
  color: var(--text-secondary);
  font-size: 12px;
  flex-shrink: 0;
}

.modes {
  display: flex;
  gap: 2px;
}

.modes button {
  height: 20px;
  padding: 0 8px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 11px;
}

.modes button.on {
  background: var(--accent-dim);
  color: var(--accent);
}

.canvas-wrap {
  position: relative;
  flex: 1;
  min-height: 0;
}

.canvas-host {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.canvas-host :deep(canvas) {
  width: 100% !important;
  height: 100% !important;
  display: block;
}

.overlay-tools {
  position: absolute;
  bottom: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border-radius: 8px;
  background: rgba(17, 24, 39, 0.88);
  border: 1px solid var(--border-subtle);
  backdrop-filter: blur(6px);
}

.overlay-tools.left {
  left: 12px;
}

.overlay-tools.right {
  right: 12px;
}

.overlay-bar.bottom {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  pointer-events: none;
}

.overlay-bar .seg {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border-radius: 8px;
  background: rgba(17, 24, 39, 0.9);
  border: 1px solid var(--border-subtle);
}

.overlay-bar .seg button {
  height: 26px;
  padding: 0 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
}

.overlay-bar .seg button.on {
  background: var(--bg-active);
  color: var(--text-primary);
}

.tool {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
}

.tool:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.scale {
  min-width: 40px;
  padding: 0 6px;
  color: var(--text-secondary);
  font-size: 12px;
  text-align: center;
}

.muted {
  color: var(--text-muted);
}
</style>

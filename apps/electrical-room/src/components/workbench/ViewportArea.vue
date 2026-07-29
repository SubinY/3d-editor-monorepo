<script setup lang="ts">
import type { ViewMode } from './types'

defineProps<{
  viewMode: ViewMode
}>()
</script>

<template>
  <main class="viewport-area">
    <div v-show="viewMode !== '3d'" class="pane">
      <div class="pane-label">2D 平面</div>
      <div class="viewport">
        <slot name="canvas2d" />
      </div>
    </div>
    <div v-show="viewMode !== '2d'" class="pane">
      <div class="pane-label">3D 预览</div>
      <div class="viewport">
        <slot name="canvas3d" />
      </div>
    </div>
    <slot name="chrome" />
  </main>
</template>

<style scoped>
.viewport-area {
  flex: 1;
  display: flex;
  min-width: 0;
  gap: 1px;
  background: #1d2c3e;
  position: relative;
}

.pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: #0b111b;
}

.pane-label {
  padding: 5px 12px;
  font-size: 11px;
  letter-spacing: 1px;
  color: #5d7188;
  background: #0e1621;
  border-bottom: 1px solid #1d2c3e;
}

.viewport {
  flex: 1;
  min-height: 0;
  position: relative;
  overflow: hidden;
}

.viewport :deep(> *) {
  width: 100%;
  height: 100%;
}
</style>

<script setup lang="ts">
import type { ViewMode } from '../mock-data'

defineProps<{
  viewMode: ViewMode
}>()

const emit = defineEmits<{
  'update:viewMode': [mode: ViewMode]
  'toggle-grid': []
  'toggle-snap-guide': []
}>()
</script>

<template>
  <div class="view-bar">
    <button type="button" title="网格" @click="emit('toggle-grid')">
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7">
        <path d="M4 4h16v16H4zM4 12h16M12 4v16" />
      </svg>
    </button>
    <button type="button" title="对齐参考" @click="emit('toggle-snap-guide')">
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7">
        <path d="M4 12h16M12 4v16M7 7l10 10M17 7 7 17" />
      </svg>
    </button>
    <div class="seg">
      <button type="button" :class="{ on: viewMode === '2d' }" @click="emit('update:viewMode', '2d')">二维</button>
      <button type="button" :class="{ on: viewMode === '3d' || viewMode === 'split' }" @click="emit('update:viewMode', '3d')">
        三维
      </button>
    </div>
    <button type="button" title="显隐" class="icon">
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7">
        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    </button>
    <button type="button" title="模型" class="icon">
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7">
        <path d="M12 3 3 8l9 5 9-5-9-5zM3 16l9 5 9-5M3 12l9 5 9-5" />
      </svg>
    </button>
    <button type="button" title="图层" class="icon">
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7">
        <path d="M12 3 3 8l9 5 9-5-9-5zM3 13l9 5 9-5M3 18l9 5 9-5" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.view-bar {
  position: absolute;
  left: 50%;
  bottom: 58px;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 7px;
  background: rgba(10, 16, 26, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  z-index: 8;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(8px);
}
button {
  border: 0;
  background: transparent;
  color: #9db0c5;
  width: 32px;
  height: 32px;
  border-radius: 999px;
  cursor: pointer;
  display: grid;
  place-items: center;
}
button:hover {
  color: #e8f4ff;
  background: rgba(255, 255, 255, 0.06);
}
.seg {
  display: flex;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 999px;
  padding: 2px;
  margin: 0 2px;
}
.seg button {
  width: auto;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 600;
}
.seg button.on {
  background: #1f6fff;
  color: #fff;
}
</style>

<script setup lang="ts">
import type { ViewMode } from './types'

defineProps<{
  viewMode: ViewMode
}>()

const emit = defineEmits<{
  'update:viewMode': [mode: ViewMode]
}>()
</script>

<template>
  <div class="view-bar">
    <div class="seg">
      <button type="button" :class="{ on: viewMode === '2d' }" @click="emit('update:viewMode', '2d')">
        二维
      </button>
      <button
        type="button"
        :class="{ on: viewMode === 'split' }"
        @click="emit('update:viewMode', 'split')"
      >
        并排
      </button>
      <button type="button" :class="{ on: viewMode === '3d' }" @click="emit('update:viewMode', '3d')">
        三维
      </button>
    </div>
  </div>
</template>

<style scoped>
.view-bar {
  position: absolute;
  left: 50%;
  bottom: 14px;
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
.seg {
  display: flex;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 999px;
  padding: 2px;
}
.seg button {
  border: 0;
  background: transparent;
  color: #9db0c5;
  width: auto;
  height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
}
.seg button:hover {
  color: #e8f4ff;
}
.seg button.on {
  background: #1f6fff;
  color: #fff;
}
</style>

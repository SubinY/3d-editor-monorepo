<template>
  <Transition name="fade">
    <div v-if="visible" class="transform-toolbar">
      <div class="toolbar-inner">
        <button
          v-for="tool in transformButtons"
          :key="tool.id"
          class="tool-btn"
          :class="{ active: tool.id === activeTool }"
          :title="tool.title"
          @click="$emit('change-tool', tool.id)"
        >
          <Icon :icon="tool.icon" class="icon" />
          <span class="label">{{ tool.label }}</span>
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

const transformButtons = [
  { id: 'translate', label: '移动', title: '平移物料 (G/T)', icon: 'mdi:cursor-move' },
  { id: 'rotate', label: '旋转', title: '旋转物料 (R)', icon: 'mdi:rotate-3d-variant' },
  { id: 'scale', label: '缩放', title: '缩放物料 (S)', icon: 'mdi:arrow-expand-all' }
] as const

type TransformMode = (typeof transformButtons)[number]['id']

defineProps<{
  visible: boolean
  activeTool: TransformMode
}>()

defineEmits<{
  (e: 'change-tool', mode: TransformMode): void
}>()
</script>

<style scoped>
.transform-toolbar {
  position: absolute;
  top: 100px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
}

.toolbar-inner {
  display: flex;
  gap: 10px;
  padding: 6px;
  background: rgba(10, 20, 40, 0.8);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(77, 163, 255, 0.4);
  border-radius: 8px;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
}

.tool-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.3s;
}

.tool-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.tool-btn.active {
  background: #4da3ff;
  color: #fff;
  box-shadow: 0 0 15px rgba(77, 163, 255, 0.5);
}

.icon {
  font-size: 20px;
}

.label {
  font-size: 14px;
  font-weight: 500;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -20px);
}
</style>



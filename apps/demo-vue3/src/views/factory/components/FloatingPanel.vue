<template>
  <VueDraggableResizable
    v-show="visible"
    v-model:x="xModel"
    v-model:y="yModel"
    v-model:w="wModel"
    v-model:h="hModel"
    :parent="false"
    :z="zIndex"
    :draggable="true"
    :resizable="true"
    :active="true"
    drag-handle=".floating-header"
    class="floating-panel"
    @activated="raise"
  >
    <div class="panel-border-glow"></div>
    <header class="floating-header">
      <div class="header-content">
        <span class="title-line"></span>
        <div class="title">
          {{ title }}
          <span class="title-en">>>> {{ titleEn }}</span>
        </div>
      </div>
      <div class="actions">
        <button class="action-btn" @click.stop="toggleMinify">
          <Icon :icon="minimized ? 'mdi:window-maximize' : 'mdi:window-minimize'" />
        </button>
        <button class="action-btn close" @click.stop="close">
          <Icon icon="mdi:close" />
        </button>
      </div>
    </header>
    <section class="floating-body" v-show="!minimized">
      <slot />
    </section>
  </VueDraggableResizable>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import VueDraggableResizable from 'vue3-draggable-resizable'
import 'vue3-draggable-resizable/dist/Vue3DraggableResizable.css'
import { Icon } from '@iconify/vue'

const props = defineProps<{
  title: string
  icon: string
  visible: boolean
  position: { x: number; y: number }
  size: { w: number; h: number }
  zIndex: number
}>()

const titleEnMap: Record<string, string> = {
  '生产指标': 'Production Index',
  '运行指标': 'Operation Index',
  '环保指标': 'Environmental Protection Index'
}
const titleEn = computed(() => titleEnMap[props.title] || 'Dashboard')

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'update:position', value: { x: number; y: number }): void
  (e: 'update:size', value: { w: number; h: number }): void
  (e: 'focus'): void
}>()

const minimized = ref(false)
const xModel = computed({
  get: () => props.position.x,
  set: x => emit('update:position', { x, y: props.position.y })
})
const yModel = computed({
  get: () => props.position.y,
  set: y => emit('update:position', { x: props.position.x, y })
})
const wModel = computed({
  get: () => props.size.w,
  set: w => emit('update:size', { w, h: props.size.h })
})
const hModel = computed({
  get: () => props.size.h,
  set: h => emit('update:size', { w: props.size.w, h })
})

function close() {
  emit('update:visible', false)
}
function toggleMinify() {
  minimized.value = !minimized.value
}
function raise() {
  emit('focus')
}

watch(
  () => props.visible,
  v => {
    if (!v) minimized.value = false
  }
)
</script>

<style scoped>
.floating-panel {
  position: absolute;
  background: linear-gradient(135deg, rgba(10, 20, 40, 0.85), rgba(5, 10, 25, 0.95));
  border: 1px solid rgba(77, 163, 255, 0.3);
  border-radius: 4px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  backdrop-filter: blur(8px);
}

.panel-border-glow {
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
  background: linear-gradient(180deg, #4da3ff, transparent);
  box-shadow: 0 0 10px rgba(77, 163, 255, 0.5);
}

.floating-header {
  height: 36px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(77, 163, 255, 0.1);
  border-bottom: 1px solid rgba(77, 163, 255, 0.2);
  cursor: move;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.title-line {
  width: 3px;
  height: 16px;
  background: #4da3ff;
}

.title {
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  display: flex;
  align-items: center;
  gap: 10px;
}

.title-en {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
  font-weight: 400;
}

.actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  transition: all 0.2s;
}

.action-btn:hover {
  color: #4da3ff;
}

.action-btn.close:hover {
  color: #ff4d4d;
}

.floating-body {
  padding: 10px;
  height: calc(100% - 36px);
  overflow: hidden;
}
</style>
